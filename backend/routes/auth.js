const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
// sendVerificationEmail kept for reference but email gate is disabled — instant access
// const { sendVerificationEmail } = require('../lib/sendEmail');

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

  // Email verification gate removed — instant access
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

  let inviteRow = null; // hoisted so we can mark it used after insert
  if (role === 'employee' || role === 'admin') {
    const validCode = process.env.EMPLOYEE_INVITE_CODE || 'FCR2024STAFF';
    // Check hardcoded env code first, then invite_codes table
    let codeValid = inviteCode && inviteCode === validCode;

    if (!codeValid && inviteCode) {
      const db = getDb();
      const candidate = db.prepare(`
        SELECT * FROM invite_codes
        WHERE code = ? AND used_by IS NULL AND expires_at > datetime('now')
      `).get(inviteCode);
      // Code role must match requested role
      if (candidate && candidate.role === role) {
        codeValid = true;
        inviteRow = candidate;
      }
    }

    if (!codeValid) {
      return res.status(403).json({ error: 'Invalid or expired access code' });
    }
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  // email_verified = 1 immediately — email gate removed for instant access
  db.prepare(
    `INSERT INTO users (username, password_hash, role, email, funeral_home_name, email_verified)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(username, passwordHash, role, email || null, funeralHomeName || null);

  // Mark invite code as used if one was consumed
  if (inviteRow) {
    db.prepare(`
      UPDATE invite_codes SET used_by = ?, used_at = datetime('now') WHERE id = ?
    `).run(username, inviteRow.id);
  }

  res.status(201).json({
    success: true,
    message: 'Account created! You can now log in.',
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
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, email, phone, funeral_home_name FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PUT /api/auth/profile — update own email, phone, funeral_home_name
router.put('/profile', authenticateToken, (req, res) => {
  const { email, phone, funeral_home_name } = req.body;
  const db = getDb();
  db.prepare(`UPDATE users SET email = ?, phone = ?, funeral_home_name = ? WHERE id = ?`)
    .run(email || null, phone || null, funeral_home_name || null, req.user.id);
  const updated = db.prepare('SELECT id, username, role, email, phone, funeral_home_name FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: updated });
});

// PUT /api/auth/change-password — change own password (requires current_password)
router.put('/change-password', authenticateToken, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ success: true });
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

// GET /api/auth/admin/users-by-funeral-home — Admin only
const { requireRole } = require('../middleware/auth');
router.get('/admin/users-by-funeral-home', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.funeral_home_name,
           u.email_verified, u.created_at,
           fh.id as fh_id, fh.name as fh_name, fh.city as fh_city, fh.state as fh_state
    FROM users u
    LEFT JOIN funeral_homes fh ON fh.name = u.funeral_home_name AND fh.deleted_at IS NULL
    ORDER BY u.role, u.funeral_home_name, u.created_at
  `).all();

  // Mask email: j***@domain.com
  function maskEmail(email) {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return local[0] + '***@' + domain;
  }

  const staff = [];
  const byHome = {};
  for (const u of users) {
    const masked = { ...u, email: maskEmail(u.email) };
    if (u.role === 'admin' || u.role === 'employee') {
      staff.push(masked);
    } else {
      const key = u.funeral_home_name || '__unassigned__';
      if (!byHome[key]) byHome[key] = { name: u.fh_name || u.funeral_home_name || 'Unknown', city: u.fh_city, state: u.fh_state, users: [] };
      byHome[key].users.push(masked);
    }
  }

  res.json({ staff, byHome });
});

module.exports = router;
