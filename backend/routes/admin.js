const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, requireRole('admin'));

// GET /api/admin/users — list all users
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, username, role, email, phone, funeral_home_name, email_verified, created_at
    FROM users
    ORDER BY role, username
  `).all();
  res.json({ users });
});

// POST /api/admin/users — create user (admin only)
router.post('/users', (req, res) => {
  const { username, email, phone, password, role, funeral_home_name } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role are required' });
  }
  if (!['admin', 'employee', 'funeral_home'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (role === 'funeral_home' && !funeral_home_name) {
    return res.status(400).json({ error: 'funeral_home_name is required for funeral_home role' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, email, phone, funeral_home_name, email_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(username, passwordHash, role, email || null, phone || null, funeral_home_name || null);

  const user = db.prepare('SELECT id, username, role, email, phone, funeral_home_name, email_verified, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ user });
});

// PUT /api/admin/users/:id — edit user (admin only)
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { email, phone, role, funeral_home_name } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (role && !['admin', 'employee', 'funeral_home'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.prepare(`
    UPDATE users SET
      email = ?,
      phone = ?,
      role = ?,
      funeral_home_name = ?
    WHERE id = ?
  `).run(
    email !== undefined ? (email || null) : user.email,
    phone !== undefined ? (phone || null) : user.phone,
    role || user.role,
    funeral_home_name !== undefined ? (funeral_home_name || null) : user.funeral_home_name,
    id
  );

  const updated = db.prepare('SELECT id, username, role, email, phone, funeral_home_name, email_verified, created_at FROM users WHERE id = ?').get(id);
  res.json({ user: updated });
});

// PUT /api/admin/users/:id/reset-password — admin resets user password (no old password required)
router.put('/users/:id/reset-password', (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'new_password is required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, id);
  res.json({ success: true });
});

// DELETE /api/admin/users/:id — delete user (cannot delete self)
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Invite Codes ─────────────────────────────────────────────────────────────

// POST /api/admin/invite-codes — generate a new code
router.post('/invite-codes', (req, res) => {
  const { role = 'employee' } = req.body;
  if (!['admin', 'employee', 'funeral_home'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Generate FCR-XXXXXXXX (8 random alphanum chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusables (0/O, 1/I)
  let suffix = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  const code = `FCR-${suffix}`;

  // Expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO invite_codes (code, role, created_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(code, role, req.user.username, expiresAt);

  const row = db.prepare('SELECT * FROM invite_codes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ code: row });
});

// GET /api/admin/invite-codes — list all codes
router.get('/invite-codes', (req, res) => {
  const db = getDb();
  const codes = db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC').all();
  res.json({ codes });
});

// DELETE /api/admin/invite-codes/:id — revoke a code
router.delete('/invite-codes/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const code = db.prepare('SELECT id FROM invite_codes WHERE id = ?').get(id);
  if (!code) return res.status(404).json({ error: 'Code not found' });
  db.prepare('DELETE FROM invite_codes WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
