const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Resend } = require('resend');

const router = express.Router();

const ATTACHMENTS_DIR = process.env.RAILWAY_ENVIRONMENT
  ? '/data/attachments'
  : path.join(__dirname, '../local-attachments');

// Ensure base dir exists
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(ATTACHMENTS_DIR, req.params.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// POST /api/transports/:id/attachments — upload file
router.post('/:id/attachments', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDb();
  const transport = db.prepare('SELECT id FROM transports WHERE id = ?').get(req.params.id);
  if (!transport) return res.status(404).json({ error: 'Transport not found' });

  const result = db.prepare(`
    INSERT INTO transport_attachments (transport_id, original_name, stored_path, mime_type, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    req.file.originalname,
    req.file.path,
    req.file.mimetype || null,
    req.file.size || null,
    req.user.username
  );

  const attachment = db.prepare('SELECT * FROM transport_attachments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ attachment });
});

// GET /api/transports/:id/attachments — list attachments
router.get('/:id/attachments', authenticateToken, (req, res) => {
  const db = getDb();
  const attachments = db.prepare(
    'SELECT * FROM transport_attachments WHERE transport_id = ? ORDER BY uploaded_at DESC'
  ).all(req.params.id);
  res.json({ attachments });
});

// GET /api/transports/:id/attachments/:aid/download — download file
router.get('/:id/attachments/:aid/download', authenticateToken, (req, res) => {
  const db = getDb();
  const att = db.prepare(
    'SELECT * FROM transport_attachments WHERE id = ? AND transport_id = ?'
  ).get(req.params.aid, req.params.id);

  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  if (!fs.existsSync(att.stored_path)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${att.original_name}"`);
  if (att.mime_type) res.setHeader('Content-Type', att.mime_type);
  res.sendFile(path.resolve(att.stored_path));
});

// DELETE /api/transports/:id/attachments/:aid — admin only
router.delete('/:id/attachments/:aid', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const att = db.prepare(
    'SELECT * FROM transport_attachments WHERE id = ? AND transport_id = ?'
  ).get(req.params.aid, req.params.id);

  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  // Delete from disk
  if (fs.existsSync(att.stored_path)) {
    try { fs.unlinkSync(att.stored_path); } catch (_) {}
  }

  db.prepare('DELETE FROM transport_attachments WHERE id = ?').run(req.params.aid);
  res.json({ message: 'Attachment deleted' });
});

// POST /api/transports/:id/attachments/:aid/email — send via Resend
router.post('/:id/attachments/:aid/email', authenticateToken, async (req, res) => {
  const { to, subject, message } = req.body;
  if (!to) return res.status(400).json({ error: 'to is required' });

  const db = getDb();
  const att = db.prepare(
    'SELECT * FROM transport_attachments WHERE id = ? AND transport_id = ?'
  ).get(req.params.aid, req.params.id);

  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  if (!fs.existsSync(att.stored_path)) return res.status(404).json({ error: 'File not found on disk' });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY || 're_DfxCWGDy_H7v4EvaGY6Pzc4VJZE4pDWxe');
    const fileContent = fs.readFileSync(att.stored_path);

    await resend.emails.send({
      from: 'First Call Removals <leads@knowlegalleads.com>',
      to: [to],
      subject: subject || `Document: ${att.original_name}`,
      html: `<p>${message || 'Please find the attached document.'}</p><p>— First Call Removals</p>`,
      attachments: [
        {
          filename: att.original_name,
          content: fileContent.toString('base64'),
        }
      ]
    });

    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('[attachments email]', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

module.exports = router;
