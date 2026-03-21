const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function rowToInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    transportId: row.transport_id,
    funeralHomeName: row.funeral_home_name,
    funeralHomeEmail: row.funeral_home_email,
    decedentName: row.decedent_name,
    pickupFee: row.pickup_fee,
    mileageFee: row.mileage_fee,
    obFee: row.ob_fee,
    adminFee: row.admin_fee,
    totalCost: row.total_cost,
    actualMiles: row.actual_miles,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    approvedBy: row.approved_by,
  };
}

// GET /api/invoices
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  }
  res.json({ invoices: rows.map(rowToInvoice) });
});

// POST /api/invoices — create draft from transport
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const {
    transportId, funeralHomeName, funeralHomeEmail, decedentName,
    pickupFee, mileageFee, obFee, adminFee, totalCost, actualMiles, notes
  } = req.body;

  if (!transportId) return res.status(400).json({ error: 'transportId is required' });

  const db = getDb();
  // Check transport exists
  const t = db.prepare('SELECT * FROM transports WHERE id = ?').get(transportId);
  if (!t) return res.status(404).json({ error: 'Transport not found' });

  const result = db.prepare(`
    INSERT INTO invoices (
      transport_id, funeral_home_name, funeral_home_email, decedent_name,
      pickup_fee, mileage_fee, ob_fee, admin_fee, total_cost, actual_miles, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    transportId,
    funeralHomeName || t.funeral_home_name || null,
    funeralHomeEmail || null,
    decedentName || t.decedent_name || null,
    parseFloat(pickupFee) || t.pickup_fee || 0,
    parseFloat(mileageFee) || t.mileage_fee || 0,
    parseFloat(obFee) || t.ob_fee || 0,
    parseFloat(adminFee) || t.admin_fee || 10,
    parseFloat(totalCost) || t.total_cost || 0,
    parseInt(actualMiles) || t.actual_miles || 0,
    notes || null
  );

  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ invoice: rowToInvoice(row) });
});

// PUT /api/invoices/:id/approve
router.put('/:id/approve', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'sent') return res.status(400).json({ error: 'Invoice already sent' });

  db.prepare(`UPDATE invoices SET status = 'approved', approved_at = ?, approved_by = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.user.username, id);

  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json({ invoice: rowToInvoice(row) });
});

// PUT /api/invoices/:id/send — send email via Resend
router.put('/:id/send', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (!inv.funeral_home_email) return res.status(400).json({ error: 'No email address on invoice' });
  if (inv.status === 'draft') return res.status(400).json({ error: 'Invoice must be approved before sending' });

  const apiKey = process.env.RESEND_API_KEY || 're_DfxCWGDy_H7v4EvaGY6Pzc4VJZE4pDWxe';
  const fromEmail = 'leads@knowlegalleads.com';

  const invoiceHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 20px; }
  .meta { color: #555; font-size: 14px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  td, th { padding: 8px 12px; border: 1px solid #ddd; font-size: 14px; }
  th { background: #f5f5f5; text-align: left; }
  .total { font-weight: bold; font-size: 16px; }
  .footer { color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; }
  .payment { background: #f0f7ff; border: 1px solid #bbd6f7; border-radius: 6px; padding: 14px; margin-top: 16px; font-size: 14px; }
</style></head>
<body>
  <h1>🚐 Invoice — First Call Removals</h1>
  <div class="meta">
    <div><strong>Decedent:</strong> ${inv.decedent_name || '—'}</div>
    <div><strong>Funeral Home:</strong> ${inv.funeral_home_name || '—'}</div>
    <div><strong>Transport ID:</strong> ${inv.transport_id}</div>
    <div><strong>Invoice Date:</strong> ${new Date(inv.created_at).toLocaleDateString()}</div>
    ${inv.actual_miles ? `<div><strong>Actual Miles:</strong> ${inv.actual_miles}</div>` : ''}
  </div>
  <table>
    <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
    <tr><td>Pickup Fee</td><td style="text-align:right">$${parseFloat(inv.pickup_fee).toFixed(2)}</td></tr>
    ${inv.mileage_fee > 0 ? `<tr><td>Mileage Fee</td><td style="text-align:right">$${parseFloat(inv.mileage_fee).toFixed(2)}</td></tr>` : ''}
    ${inv.ob_fee > 0 ? `<tr><td>Oversize/Bariatric Fee</td><td style="text-align:right">$${parseFloat(inv.ob_fee).toFixed(2)}</td></tr>` : ''}
    <tr><td>Administrative Fee</td><td style="text-align:right">$${parseFloat(inv.admin_fee).toFixed(2)}</td></tr>
    <tr class="total"><td><strong>Total Due</strong></td><td style="text-align:right"><strong>$${parseFloat(inv.total_cost).toFixed(2)}</strong></td></tr>
  </table>
  ${inv.notes ? `<p><strong>Notes:</strong> ${inv.notes}</p>` : ''}
  <div class="payment">
    <strong>Payment Instructions</strong><br>
    Please remit payment within 30 days. Contact us at <a href="mailto:leads@knowlegalleads.com">leads@knowlegalleads.com</a> with any questions.<br>
    Reference transport ID: <strong>${inv.transport_id}</strong>
  </div>
  <div class="footer">STAT First Call Removals · Professional Funeral Transport<br>
  This invoice was generated automatically. Please retain for your records.</div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `First Call Removals <${fromEmail}>`,
        to: [inv.funeral_home_email],
        subject: `Invoice — ${inv.decedent_name || inv.transport_id} — First Call Removals`,
        html: invoiceHtml,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(502).json({ error: `Email send failed: ${errData.message || response.statusText}` });
    }

    db.prepare(`UPDATE invoices SET status = 'sent', sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);

    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    res.json({ invoice: rowToInvoice(row) });
  } catch (err) {
    res.status(500).json({ error: `Send failed: ${err.message}` });
  }
});

// PUT /api/invoices/:id — update draft fields
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'sent') return res.status(400).json({ error: 'Cannot edit a sent invoice' });

  const { funeralHomeName, funeralHomeEmail, decedentName, pickupFee, mileageFee, obFee, adminFee, totalCost, actualMiles, notes } = req.body;

  const updates = [], values = [];
  if (funeralHomeName !== undefined) { updates.push('funeral_home_name = ?'); values.push(funeralHomeName); }
  if (funeralHomeEmail !== undefined) { updates.push('funeral_home_email = ?'); values.push(funeralHomeEmail); }
  if (decedentName !== undefined) { updates.push('decedent_name = ?'); values.push(decedentName); }
  if (pickupFee !== undefined) { updates.push('pickup_fee = ?'); values.push(parseFloat(pickupFee)); }
  if (mileageFee !== undefined) { updates.push('mileage_fee = ?'); values.push(parseFloat(mileageFee)); }
  if (obFee !== undefined) { updates.push('ob_fee = ?'); values.push(parseFloat(obFee)); }
  if (adminFee !== undefined) { updates.push('admin_fee = ?'); values.push(parseFloat(adminFee)); }
  if (totalCost !== undefined) { updates.push('total_cost = ?'); values.push(parseFloat(totalCost)); }
  if (actualMiles !== undefined) { updates.push('actual_miles = ?'); values.push(parseInt(actualMiles)); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json({ invoice: rowToInvoice(row) });
});

module.exports = router;
