/**
 * seed-clients.js — Import customers.csv into funeral_homes + funeral_home_callers
 * Exported as a function for auto-run on server startup (idempotent).
 * Also runnable standalone: node backend/scripts/seed-clients.js
 */

const path = require('path');
const fs = require('fs');

function seedClients(db) {
  // Find the CSV
  const candidates = [
    path.join(__dirname, 'customers.csv'),
    path.join(__dirname, '../../customers.csv'),
  ];
  const CSV_PATH = candidates.find(p => fs.existsSync(p));
  if (!CSV_PATH) {
    console.log('[seed] customers.csv not found — skipping client seed');
    return;
  }

  const { parse } = require('csv-parse/sync');
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
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

  const insertHome = db.prepare(`
    INSERT INTO funeral_homes (name, address, city, state, zip, phone, email)
    VALUES (@name, @address, @city, @state, @zip, @phone, @email)
  `);
  const insertCaller = db.prepare(`
    INSERT INTO funeral_home_callers (funeral_home_id, name, phone, email)
    VALUES (@funeral_home_id, @name, @phone, @email)
  `);
  const getHome = db.prepare(`SELECT id FROM funeral_homes WHERE name = ? AND deleted_at IS NULL`);

  let homesAdded = 0, homesSkipped = 0, callersAdded = 0;

  const seedAll = db.transaction(() => {
    for (const [name, home] of Object.entries(homes)) {
      const existing = getHome.get(name);
      if (existing) { homesSkipped++; continue; }
      const result = insertHome.run(home);
      homesAdded++;
      for (const caller of home.callers) {
        insertCaller.run({ funeral_home_id: result.lastInsertRowid, ...caller });
        callersAdded++;
      }
    }
  });

  seedAll();
  if (homesAdded > 0) {
    console.log(`[seed] Clients seeded: ${homesAdded} funeral homes, ${callersAdded} callers added (${homesSkipped} already existed)`);
  } else {
    console.log(`[seed] All ${homesSkipped} funeral homes already in DB — nothing to add`);
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
