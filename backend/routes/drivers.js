const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function rowToDriver(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    currentLocation: row.current_location,
    phone: row.phone || null,
    notes: row.notes || null
  };
}

// GET /api/drivers
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM drivers ORDER BY name').all();
  res.json({ drivers: rows.map(rowToDriver) });
});

// POST /api/drivers
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, status = 'Available', currentLocation, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  const id = 'D' + Date.now().toString().slice(-6);
  db.prepare('INSERT INTO drivers (id, name, status, current_location, phone, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, status, currentLocation || null, phone || null, notes || null);

  const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  res.status(201).json({ driver: rowToDriver(row) });
});

// PUT /api/drivers/:id
router.put('/:id', authenticateToken, requireRole('admin', 'employee'), (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Driver not found' });

  const { name, status, currentLocation, phone, notes } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (currentLocation !== undefined) { updates.push('current_location = ?'); values.push(currentLocation); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  db.prepare(`UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  res.json({ driver: rowToDriver(row) });
});

// DELETE /api/drivers/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Driver not found' });
  db.prepare('DELETE FROM drivers WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
