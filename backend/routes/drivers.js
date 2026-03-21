const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendDriverSMS } = require('../lib/sendSMS');

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

// GET /api/drivers/:id/active-count — count of non-completed/cancelled transports for driver
router.get('/:id/active-count', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM transports
    WHERE assigned_driver_id = ?
    AND status NOT IN ('Completed', 'Cancelled')
  `).get(id);
  res.json({ count });
});

// GET /api/drivers/:id/latest-odometer — latest end odometer reading for a driver
router.get('/:id/latest-odometer', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const reading = db.prepare(`
    SELECT odometer FROM odometer_readings
    WHERE driver_id = ? AND reading_type = 'end'
    ORDER BY recorded_at DESC LIMIT 1
  `).get(id);
  res.json({ odometer: reading ? reading.odometer : null });
});

// POST /api/drivers/:id/end-of-day-check — trigger end-of-day SMS if all transports done
router.post('/:id/end-of-day-check', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  // Check if SMS already sent in last 4 hours
  if (driver.end_of_day_sms_sent_at) {
    const sentAt = new Date(driver.end_of_day_sms_sent_at).getTime();
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    if (sentAt > fourHoursAgo) {
      return res.json({ sent: false, reason: 'SMS sent within last 4 hours' });
    }
  }

  // Count active transports
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM transports
    WHERE assigned_driver_id = ?
    AND status NOT IN ('Completed', 'Cancelled')
  `).get(id);

  if (count > 0) {
    return res.json({ sent: false, reason: `Driver still has ${count} active transport(s)` });
  }

  if (!driver.phone) {
    return res.json({ sent: false, reason: 'No phone number on file for driver' });
  }

  const message = `🚐 FCR End of Day — All calls complete! Please enter your final odometer reading by replying to this message or logging in at firstcallremovals.com. Thank you!`;

  await sendDriverSMS(driver.phone, message);

  // Mark SMS as sent
  db.prepare("UPDATE drivers SET end_of_day_sms_sent_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);

  res.json({ sent: true });
});

module.exports = router;
