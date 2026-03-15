const express = require('express');
const multer = require('multer');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// GET /api/funeral-homes — list all (auth required)
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fh.*, COUNT(fhc.id) as caller_count
    FROM funeral_homes fh
    LEFT JOIN funeral_home_callers fhc ON fhc.funeral_home_id = fh.id
    WHERE fh.deleted_at IS NULL
    GROUP BY fh.id
    ORDER BY fh.name
  `).all();
  res.json({ funeralHomes: rows });
});

// POST /api/funeral-homes/import-csv — must be before /:id routes
router.post('/import-csv', authenticateToken, requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

  const content = req.file.buffer.toString('utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

  const headers = parseCSVLine(lines[0]);
  const colIdx = {};
  ['name', 'address', 'city', 'state', 'zip', 'phone', 'email'].forEach(col => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === col);
    if (idx >= 0) colIdx[col] = idx;
  });

  if (colIdx.name === undefined) return res.status(400).json({ error: 'CSV must have a "name" column' });

  const db = getDb();
  let imported = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols.length) continue;
    const name = cols[colIdx.name]?.trim();
    if (!name) continue;

    const existing = db.prepare('SELECT id FROM funeral_homes WHERE name = ? AND deleted_at IS NULL').get(name);
    if (existing) { skipped++; continue; }

    const address = colIdx.address !== undefined ? cols[colIdx.address]?.trim() || null : null;
    const city = colIdx.city !== undefined ? cols[colIdx.city]?.trim() || null : null;
    const state = colIdx.state !== undefined ? cols[colIdx.state]?.trim() || null : null;
    const zip = colIdx.zip !== undefined ? cols[colIdx.zip]?.trim() || null : null;
    const phone = colIdx.phone !== undefined ? cols[colIdx.phone]?.trim() || null : null;
    const email = colIdx.email !== undefined ? cols[colIdx.email]?.trim() || null : null;

    const destParts = [address, city && state ? `${city}, ${state}` : city || state, zip].filter(Boolean);
    const default_destination = destParts.length ? destParts.join(', ') : null;

    db.prepare(`
      INSERT INTO funeral_homes (name, address, city, state, zip, phone, email, default_destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, address, city, state, zip, phone, email, default_destination);
    imported++;
  }

  res.json({ imported, skipped });
});

// POST /api/funeral-homes — create (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, address, city, state, zip, phone, email, default_destination, intake_format, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO funeral_homes (name, address, city, state, zip, phone, email, default_destination, intake_format, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, address || null, city || null, state || null, zip || null, phone || null, email || null,
    default_destination || null, intake_format || null, notes || null);

  const row = db.prepare('SELECT * FROM funeral_homes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ funeralHome: row });
});

// PUT /api/funeral-homes/:id — update (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM funeral_homes WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return res.status(404).json({ error: 'Funeral home not found' });

  const { name, address, city, state, zip, phone, email, default_destination, intake_format, notes } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address); }
  if (city !== undefined) { updates.push('city = ?'); values.push(city); }
  if (state !== undefined) { updates.push('state = ?'); values.push(state); }
  if (zip !== undefined) { updates.push('zip = ?'); values.push(zip); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
  if (email !== undefined) { updates.push('email = ?'); values.push(email); }
  if (default_destination !== undefined) { updates.push('default_destination = ?'); values.push(default_destination); }
  if (intake_format !== undefined) { updates.push('intake_format = ?'); values.push(intake_format); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  db.prepare(`UPDATE funeral_homes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM funeral_homes WHERE id = ?').get(id);
  res.json({ funeralHome: row });
});

// DELETE /api/funeral-homes/:id — soft delete (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM funeral_homes WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return res.status(404).json({ error: 'Funeral home not found' });
  db.prepare("UPDATE funeral_homes SET deleted_at = datetime('now') WHERE id = ?").run(id);
  res.json({ message: 'Funeral home deleted' });
});

// GET /api/funeral-homes/:id/callers
router.get('/:id/callers', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const callers = db.prepare('SELECT * FROM funeral_home_callers WHERE funeral_home_id = ? ORDER BY name').all(id);
  res.json({ callers });
});

// POST /api/funeral-homes/:id/callers
router.post('/:id/callers', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, phone, email, user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  const existing = db.prepare('SELECT * FROM funeral_homes WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) return res.status(404).json({ error: 'Funeral home not found' });

  const result = db.prepare(`
    INSERT INTO funeral_home_callers (funeral_home_id, name, phone, email, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, phone || null, email || null, user_id || null);

  const caller = db.prepare('SELECT * FROM funeral_home_callers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ caller });
});

module.exports = router;
