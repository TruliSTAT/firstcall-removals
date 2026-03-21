/**
 * seed-clients.js — Import customers.csv into funeral_homes + funeral_home_callers
 * Exported as a function for auto-run on server startup (idempotent).
 * Also runnable standalone: node backend/scripts/seed-clients.js
 */

const path = require('path');
const fs = require('fs');

function seedClients(db) {
  const { parse } = require('csv-parse/sync');

  const insertHome = db.prepare(`
    INSERT INTO funeral_homes (name, address, city, state, zip, phone, email)
    VALUES (@name, @address, @city, @state, @zip, @phone, @email)
  `);
  const insertCaller = db.prepare(`
    INSERT INTO funeral_home_callers (funeral_home_id, name, phone, email)
    VALUES (@funeral_home_id, @name, @phone, @email)
  `);
  const getHome = db.prepare(`SELECT id FROM funeral_homes WHERE name = ? AND deleted_at IS NULL`);

  let totalHomesAdded = 0, totalHomesSkipped = 0, totalCallersAdded = 0;

  // ── Source 1: customers-import.csv (simple format: name,address,city,state,zip,phone,email) ──
  const importCandidates = [
    path.join(__dirname, 'customers-import.csv'),
    path.join(__dirname, '../../customers-import.csv'),
  ];
  const importCsvPath = importCandidates.find(p => fs.existsSync(p));
  if (importCsvPath) {
    const csv = fs.readFileSync(importCsvPath, 'utf-8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
    const seedImport = db.transaction(() => {
      for (const row of rows) {
        const name = (row['name'] || '').trim();
        if (!name) continue;
        const existing = getHome.get(name);
        if (existing) { totalHomesSkipped++; continue; }
        insertHome.run({
          name,
          address: (row['address'] || '').trim(),
          city: (row['city'] || '').trim(),
          state: (row['state'] || '').trim(),
          zip: (row['zip'] || '').trim(),
          phone: (row['phone'] || '').trim(),
          email: (row['email'] || '').trim(),
        });
        totalHomesAdded++;
      }
    });
    seedImport();
    console.log(`[seed] customers-import.csv: ${totalHomesAdded} homes added, ${totalHomesSkipped} already existed`);
  }

  // ── Source 2: customers.csv (legacy format: Company Name, Street Address 1, etc.) ──
  const legacyCandidates = [
    path.join(__dirname, 'customers.csv'),
    path.join(__dirname, '../../customers.csv'),
  ];
  const legacyCsvPath = legacyCandidates.find(p => fs.existsSync(p));
  if (legacyCsvPath) {
    const csv = fs.readFileSync(legacyCsvPath, 'utf-8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

    // Group rows by Company Name
    const homes = {};
    for (const row of rows) {
      const company = (row['Company Name'] || '').trim();
      if (!company) continue;
      if (!homes[company]) {
        homes[company] = {
          name: company,
          address: (row['Street Address 1'] || '').trim(),
          city: (row['City'] || '').trim(),
          state: (row['State'] || '').trim(),
          zip: (row['Postal Code'] || '').trim(),
          phone: (row['Phone Number'] || '').trim(),
          email: (row['Email Address'] || '').trim(),
          callers: [],
        };
      }
      const callerName = (row['First Name'] || '').trim();
      if (callerName) {
        homes[company].callers.push({
          name: callerName,
          phone: (row['Phone Number'] || '').trim(),
          email: (row['Email Address'] || '').trim(),
        });
      }
    }

    let legacyAdded = 0, legacySkipped = 0, legacyCallers = 0;
    const seedLegacy = db.transaction(() => {
      for (const [name, home] of Object.entries(homes)) {
        const existing = getHome.get(name);
        if (existing) {
          legacySkipped++;
          // Still add callers if home exists
          for (const caller of home.callers) {
            const callerExists = db.prepare(
              'SELECT id FROM funeral_home_callers WHERE funeral_home_id = ? AND name = ?'
            ).get(existing.id, caller.name);
            if (!callerExists) {
              insertCaller.run({ funeral_home_id: existing.id, ...caller });
              legacyCallers++;
            }
          }
          continue;
        }
        const result = insertHome.run(home);
        legacyAdded++;
        for (const caller of home.callers) {
          insertCaller.run({ funeral_home_id: result.lastInsertRowid, ...caller });
          legacyCallers++;
        }
      }
    });
    seedLegacy();
    totalHomesAdded += legacyAdded;
    totalHomesSkipped += legacySkipped;
    totalCallersAdded += legacyCallers;
    if (legacyAdded > 0 || legacyCallers > 0) {
      console.log(`[seed] customers.csv: ${legacyAdded} homes, ${legacyCallers} callers added`);
    }
  }

  if (!importCsvPath && !legacyCsvPath) {
    console.log('[seed] No customer CSV files found — skipping client seed');
  }
}

// Standalone execution
if (require.main === module) {
  const Database = require('better-sqlite3');
  const { initDb, getDb } = require('../database');
  initDb();
  seedClients(getDb());
}

module.exports = { seedClients };
