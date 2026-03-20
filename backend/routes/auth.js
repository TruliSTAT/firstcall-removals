const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { sendVerificationEmail } = require('../lib/sendEmail');

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

  // Require email verification for non-admin users
  if (user.role !== 'admin' && user.email_verified === 0) {
    return res.status(403).json({
      error: 'Please verify your email before logging in. Check your inbox.',
    });
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
router.post('/register', async (req, res) => {
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
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationSentAt = new Date().toISOString();

  const result = db.prepare(
    `INSERT INTO users (username, password_hash, role, email, funeral_home_name, email_verified, verification_token, verification_sent_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(username, passwordHash, role, email || null, funeralHomeName || null, verificationToken, verificationSentAt);

  // Send verification email (non-blocking — don't fail registration if email fails)
  if (email) {
    try {
      await sendVerificationEmail(email, username, verificationToken);
    } catch (err) {
      console.error('[register] Verification email failed to send:', err.message);
      // Registration still succeeds; user will need to request a new verification
    }
  }

  res.status(201).json({
    success: true,
    message: 'Account created. Check your email to verify your account before logging in.',
  });
});

// GET /api/auth/verify-email?token=<token>
router.get('/verify-email', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(verificationPage('Invalid Link', 'No verification token was provided.', false));
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token);

  if (!user) {
    return res.status(404).send(verificationPage('Link Not Found', 'This verification link is invalid or has already been used.', false));
  }

  // Check token age — must be within 24 hours
  const sentAt = new Date(user.verification_sent_at);
  const now = new Date();
  const hoursDiff = (now - sentAt) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return res.status(410).send(verificationPage('Link Expired', 'This verification link has expired. Please register again or contact support.', false));
  }

  // Mark email as verified and clear the token
  db.prepare(
    `UPDATE users SET email_verified = 1, verification_token = NULL, verification_sent_at = NULL WHERE id = ?`
  ).run(user.id);

  return res.send(verificationPage('Email Verified!', 'Your email has been verified. You can now log in to First Call Removals.', true));
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

// ─── Helper: Verification Result HTML Page ────────────────────────────────────

function verificationPage(title, message, success) {
  const icon = success ? '✅' : '❌';
  const color = success ? '#16a34a' : '#dc2626';
  const appUrl = process.env.APP_URL || 'https://firstcallremovals.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — First Call Removals</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f4f4f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.10);
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { color: ${color}; font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    a.btn {
      display: inline-block;
      background: #2563eb;
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
    }
    a.btn:hover { background: #1d4ed8; }
    .brand { margin-top: 32px; color: #aaa; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${appUrl}" class="btn">Go to First Call Removals</a>
    <p class="brand">🚐 First Call Removals — Professional Funeral Transport</p>
  </div>
</body>
</html>`;
}

module.exports = router;
