const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function rowToVehicle(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || null,
    status: row.status,
    driverId: row.driver_id,
    driver: row.driver_name || null,
    notes: row.notes || null
  };
}

// GET /api/vehicles
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT v.*, d.name as driver_name
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver_id = d.id
    ORDER BY v.name
  `).all();
  res.json({ vehicles: rows.map(rowToVehicle) });
});

// POST /api/vehicles
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, type, status = 'Available', driverId, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  const id = 'V' + Date.now().toString().slice(-6);
  db.prepare('INSERT INTO vehicles (id, name, type, status, driver_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, type || null, status, driverId || null, notes || null);

  const row = db.prepare(`
    SELECT v.*, d.name as driver_name
    FROM vehicles v LEFT JOIN drivers d ON v.driver_id = d.id
    WHERE v.id = ?
  `).get(id);
  res.status(201).json({ vehicle: rowToVehicle(row) });
});

// PUT /api/vehicles/:id
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

  const { name, type, status, driverId, notes } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (type !== undefined) { updates.push('type = ?'); values.push(type); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (driverId !== undefined) { updates.push('driver_id = ?'); values.push(driverId || null); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  db.prepare(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const row = db.prepare(`
    SELECT v.*, d.name as driver_name
    FROM vehicles v LEFT JOIN drivers d ON v.driver_id = d.id
    WHERE v.id = ?
  `).get(id);
  res.json({ vehicle: rowToVehicle(row) });
});

// DELETE /api/vehicles/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Maintenance Routes ───────────────────────────────────────────────────────

// GET /api/vehicles/maintenance/all — list all maintenance records across all vehicles
router.get('/maintenance/all', authenticateToken, (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT m.*, v.name as vehicle_name
    FROM vehicle_maintenance m
    JOIN vehicles v ON m.vehicle_id = v.id
    ORDER BY m.performed_at DESC
  `).all();
  res.json({ maintenance: records });
});

// GET /api/vehicles/:id/maintenance — list maintenance records for a vehicle
router.get('/:id/maintenance', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const records = db.prepare(`
    SELECT m.*, v.name as vehicle_name
    FROM vehicle_maintenance m
    JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.vehicle_id = ?
    ORDER BY m.performed_at DESC
  `).all(id);

  res.json({ maintenance: records });
});

// POST /api/vehicles/:id/maintenance — add maintenance record (admin only)
router.post('/:id/maintenance', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const {
    type, description, cost, mileage_at_service, next_due_mileage,
    next_due_date, performed_by, notes, performed_at
  } = req.body;

  if (!type) return res.status(400).json({ error: 'type is required' });

  const result = db.prepare(`
    INSERT INTO vehicle_maintenance
      (vehicle_id, type, description, cost, mileage_at_service, next_due_mileage, next_due_date, performed_by, notes, performed_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, type, description || null, cost || 0,
    mileage_at_service || null, next_due_mileage || null,
    next_due_date || null, performed_by || null,
    notes || null,
    performed_at || new Date().toISOString().split('T')[0],
    req.user.username
  );

  const record = db.prepare(`
    SELECT m.*, v.name as vehicle_name
    FROM vehicle_maintenance m
    JOIN vehicles v ON m.vehicle_id = v.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ record });
});

// DELETE /api/vehicles/:id/maintenance/:recordId — delete record (admin only)
router.delete('/:id/maintenance/:recordId', authenticateToken, requireRole('admin'), (req, res) => {
  const { id, recordId } = req.params;
  const db = getDb();
  const record = db.prepare('SELECT id FROM vehicle_maintenance WHERE id = ? AND vehicle_id = ?').get(recordId, id);
  if (!record) return res.status(404).json({ error: 'Maintenance record not found' });
  db.prepare('DELETE FROM vehicle_maintenance WHERE id = ?').run(recordId);
  res.json({ success: true });
});

module.exports = router;
