const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — unread notifications for the current user
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT n.*, t.decedent_name, t.funeral_home_name
    FROM notifications n
    LEFT JOIN transports t ON n.transport_id = t.id
    WHERE n.for_user_id = ? AND n.is_read = 0
    ORDER BY n.created_at DESC
  `).all(req.user.id);

  res.json({ notifications });
});

// PUT /api/notifications/:id/read — mark a notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND for_user_id = ?')
    .run(parseInt(req.params.id), req.user.id);
  res.json({ ok: true });
});

// PUT /api/notifications/read-all — mark all as read for current user
router.put('/read-all', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE for_user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
