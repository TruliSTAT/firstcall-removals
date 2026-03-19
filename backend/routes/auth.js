const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, email, role, inviteCode, funeralHomeName } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  if (!['funeral_home', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Role must be funeral_home or employee' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (role === 'employee') {
    const validCode = process.env.EMPLOYEE_INVITE_CODE || 'FCR2024STAFF';
    if (!inviteCode || inviteCode !== validCode) {
      return res.status(403).json({ error: 'Invalid employee access code' });
    }
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, email, funeral_home_name) VALUES (?, ?, ?, ?, ?)'
  ).run(username, passwordHash, role, email || null, funeralHomeName || null);

  const token = jwt.sign(
    { id: result.lastInsertRowid, username, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, username, role }
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  // JWT is stateless; client should discard the token
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
