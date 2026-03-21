const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    transportId: row.transport_id,
    invoiceNumber: row.invoice_number,
    funeralHomeName: row.funeral_home_name,
    funeralHomeEmail: row.funeral_home_email,
    decedentName: row.decedent_name,
    decedentDob: row.decedent_dob,
    caseNumber: row.case_number,
    pickupFee: row.pickup_fee,
    mileageFee: row.mileage_fee,
    obFee: row.ob_fee,
    adminFee: row.admin_fee,
    totalCost: row.total_cost,
    actualMiles: row.actual_miles,
    notes: row.notes,
    status: row.status,
    paymentStatus: row.payment_status || 'due',
    serviceDate: row.service_date,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    pickupLocation: row.pickup_location,
    deliveryLocation: row.delivery_location,
    billToLocation: row.bill_to_location,
    customerNameFull: row.customer_name_full,
    customerStreet: row.customer_street,
    customerCity: row.customer_city,
    customerState: row.customer_state,
    customerZip: row.customer_zip,
    lineItems: row.line_items ? JSON.parse(row.line_items) : [],
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    approvedBy: row.approved_by,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
  };
}

function nextInvoiceNumber(db) {
  // Ensure settings table exists
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_seq', '1000')`).run();

  const row = db.prepare(`SELECT value FROM settings WHERE key='invoice_seq'`).get();
  const next = parseInt(row.value) + 1;
  db.prepare(`UPDATE settings SET value = ? WHERE key = 'invoice_seq'`).run(String(next));
  // Plain sequential integer (not zero-padded)
  return String(next);
}

function buildLineItems(t) {
  const items = [];

  // 1. Funeral Home Transfer - Cot (always)
  items.push({
    description: 'Funeral Home Transfer - Cot',
    sub_line_1: t.pickup_location || '',
    sub_line_2: '',
    qty: 1,
    unit_price: parseFloat(t.pickup_fee) || 0,
    amount: parseFloat(t.pickup_fee) || 0,
  });

  // 2. Additional Mileage (only if mileage_fee > 0)
  if (parseFloat(t.mileage_fee) > 0) {
    items.push({
      description: 'Additional Mileage - over 30 miles included',
      sub_line_1: `${t.actual_miles || 0} miles`,
      sub_line_2: '',
      qty: 1,
      unit_price: parseFloat(t.mileage_fee),
      amount: parseFloat(t.mileage_fee),
    });
  }

  // 3. Obese Fee (only if ob_fee > 0)
  if (parseFloat(t.ob_fee) > 0) {
    const qty = Math.ceil(parseFloat(t.ob_fee) / 50);
    items.push({
      description: 'Obese Fee',
      sub_line_1: '',
      sub_line_2: '',
      qty,
      unit_price: 50.00,
      amount: qty * 50.00,
    });
  }

  // 4. Administration Fee (always)
  items.push({
    description: 'Administration Fee',
    sub_line_1: '',
    sub_line_2: '',
    qty: 1,
    unit_price: 10.00,
    amount: 10.00,
  });

  return items;
}

function buildPreviewData(db, transportId) {
  const t = db.prepare('SELECT * FROM transports WHERE id = ?').get(transportId);
  if (!t) return null;

  // Look up funeral home address
  let fh = null;
  if (t.funeral_home_id) {
    fh = db.prepare('SELECT * FROM funeral_homes WHERE id = ?').get(t.funeral_home_id);
  }
  if (!fh && t.funeral_home_name) {
    fh = db.prepare('SELECT * FROM funeral_homes WHERE name = ? AND deleted_at IS NULL LIMIT 1').get(t.funeral_home_name);
  }

  const lineItems = buildLineItems(t);
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const total = subtotal;

  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const serviceDate = t.completed_at ? fmt(t.completed_at) : fmt(t.date);
  const issueDate = fmt(today);
  const dueDateStr = fmt(dueDate);
  const issueDateIso = today.toISOString().split('T')[0];
  const dueDateIso = dueDate.toISOString().split('T')[0];

  // Format decedent name as "LastName, FirstName" if possible
  let decedentName = t.decedent_name || '';
  if (decedentName && !decedentName.includes(',')) {
    const parts = decedentName.trim().split(' ');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const first = parts.slice(0, parts.length - 1).join(' ');
      decedentName = `${last}, ${first}`;
    }
  }

  return {
    transportId,
    invoiceNumber: null, // assigned on save
    serviceDate: serviceDate,
    serviceDateIso: t.completed_at || t.date,
    issueDate,
    issueDateIso,
    dueDate: dueDateStr,
    dueDateIso,
    caseNumber: t.case_number || '',
    decedentName,
    decedentDob: t.date_of_birth || '',
    pickupLocation: t.pickup_location || '',
    deliveryLocation: t.destination || '',
    billToLocation: t.funeral_home_name || '',
    customerNameFull: t.funeral_home_name || '',
    customerPhone: t.funeral_home_phone || '',
    customerEmail: fh?.email || '',
    customerStreet: fh?.address || '',
    customerCity: fh?.city || '',
    customerState: fh?.state || '',
    customerZip: fh?.zip || '',
    funeralHomeId: t.funeral_home_id || null,
    funeralHomeName: t.funeral_home_name || '',
    funeralHomeEmail: fh?.email || '',
    pickupFee: parseFloat(t.pickup_fee) || 0,
    mileageFee: parseFloat(t.mileage_fee) || 0,
    obFee: parseFloat(t.ob_fee) || 0,
    adminFee: 10,
    actualMiles: parseInt(t.actual_miles) || 0,
    lineItems,
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    totalCost: total,
  };
}

// ── HTML email builder ────────────────────────────────────────────────────────

function buildInvoiceHtml(inv, lineItemsArr) {
  const dobLine = inv.decedent_dob ? `, DOB: ${inv.decedent_dob}` : '';
  const pdfCreated = inv.issue_date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const serviceDate = inv.service_date || '';
  const dueDate = inv.due_date || '';
  const total = parseFloat(inv.total_cost || 0).toFixed(2);
  const subtotal = parseFloat(inv.total_cost || 0).toFixed(2);
  const invoiceNumber = inv.invoice_number || '—';

  const lineItemRows = lineItemsArr.map(item => `
    <tr style="border-bottom:1px dashed #e5e7eb">
      <td style="padding:12px 32px">
        <div style="font-size:13px;font-weight:500">${item.description}</div>
        ${item.sub_line_1 ? `<div style="font-size:12px;color:#888;font-style:italic">${item.sub_line_1}</div>` : ''}
        ${item.sub_line_2 ? `<div style="font-size:12px;color:#888;font-style:italic">${item.sub_line_2}</div>` : ''}
      </td>
      <td style="text-align:center;padding:12px;font-size:13px">${item.qty}</td>
      <td style="text-align:right;padding:12px;font-size:13px">$${parseFloat(item.unit_price).toFixed(2)}</td>
      <td style="text-align:right;padding:12px 32px;font-size:13px">$${parseFloat(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const paymentLabel = inv.payment_status === 'paid' ? 'Total Paid' : 'Total Due';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6">
<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="border-top:4px solid #2d9b6e;padding:24px 32px 16px">
    <table width="100%"><tr>
      <td>
        <div style="font-size:22px;font-weight:700;color:#1a1a2e">🚐 STAT MCS LLC</div>
        <div style="color:#555;font-size:13px;margin-top:4px">8618 Oceanmist Cove Drive<br>Cypress, TX 77433-7573</div>
        <div style="color:#555;font-size:13px">statmcs.com@gmail.com · (281) 940-6525</div>
      </td>
      <td align="right">
        <div style="font-size:13px;color:#555">Invoice #<strong>${invoiceNumber}</strong></div>
        <div style="font-size:13px;color:#555">Issue date: ${pdfCreated}</div>
      </td>
    </tr></table>
  </div>

  <!-- Case block -->
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
    <div style="font-size:26px;font-weight:700;color:#1a1a2e">Case# ${inv.case_number || '—'}, ${inv.decedent_name || '—'}${dobLine}</div>
    <div style="color:#555;font-size:13px;margin-top:6px">Pickup Location: ${inv.pickup_location || '—'}</div>
    <div style="color:#555;font-size:13px">Delivery Location: ${inv.delivery_location || '—'}</div>
    <div style="color:#555;font-size:13px">Bill to Location: ${inv.bill_to_location || '—'}</div>
  </div>

  <!-- 3-column info -->
  <table width="100%" style="border-bottom:1px solid #e5e7eb">
    <tr>
      <td width="40%" style="vertical-align:top;padding:16px 32px">
        <div style="font-weight:700;margin-bottom:6px">Customer</div>
        <div style="font-size:13px;color:#444;line-height:1.6">
          ${inv.customer_name_full || ''}${inv.funeral_home_email ? `<br>${inv.funeral_home_email}` : ''}${inv.funeral_home_phone ? `<br>${inv.funeral_home_phone}` : ''}${inv.customer_street ? `<br>${inv.customer_street}` : ''}${(inv.customer_city || inv.customer_state) ? `<br>${inv.customer_city || ''}${inv.customer_city && inv.customer_state ? ', ' : ''}${inv.customer_state || ''} ${inv.customer_zip || ''}` : ''}
        </div>
      </td>
      <td width="30%" style="vertical-align:top;padding:16px">
        <div style="font-weight:700;margin-bottom:6px">Invoice Details</div>
        <div style="font-size:13px;color:#444;line-height:1.6">
          PDF created ${pdfCreated}<br>
          <strong>$${total}</strong><br>
          Service date ${serviceDate}
        </div>
      </td>
      <td width="30%" style="vertical-align:top;padding:16px">
        <div style="font-weight:700;margin-bottom:6px">Payment</div>
        <div style="font-size:13px;color:#444;line-height:1.6">
          Due ${dueDate}<br><strong>$${total}</strong>
        </div>
      </td>
    </tr>
  </table>

  <!-- Line items table -->
  <table width="100%" style="border-collapse:collapse">
    <tr style="border-bottom:2px solid #e5e7eb">
      <th style="text-align:left;padding:12px 32px;font-size:13px">Items</th>
      <th style="text-align:center;padding:12px;font-size:13px">Quantity</th>
      <th style="text-align:right;padding:12px;font-size:13px">Price</th>
      <th style="text-align:right;padding:12px 32px;font-size:13px">Amount</th>
    </tr>
    ${lineItemRows}
    <tr style="border-top:1px dashed #d1d5db">
      <td colspan="3" style="text-align:right;padding:8px 8px;font-size:13px;color:#555">Subtotal</td>
      <td style="text-align:right;padding:8px 32px;font-size:13px">$${subtotal}</td>
    </tr>
  </table>

  <!-- Total -->
  <table width="100%" style="padding:16px 32px">
    <tr>
      <td style="font-size:22px;font-weight:700;color:#1a1a2e;padding:16px 32px">${paymentLabel}</td>
      <td style="text-align:right;font-size:22px;font-weight:700;color:#1a1a2e;padding:16px 32px">$${total}</td>
    </tr>
  </table>

  <!-- Footer note -->
  <div style="padding:16px 32px;border-top:1px solid #e5e7eb;color:#888;font-size:12px">
    First Call Removals · firstcallremovals.com · (281) 940-6525
  </div>

</div>
</body>
</html>`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/invoices/preview/:transportId — returns pre-filled data (no DB save)
router.get('/preview/:transportId', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const data = buildPreviewData(db, req.params.transportId);
  if (!data) return res.status(404).json({ error: 'Transport not found' });
  res.json({ preview: data });
});

// GET /api/invoices/counts — returns count by status bucket
router.get('/counts', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT status, COUNT(*) as count FROM invoices GROUP BY status`).all();
  const counts = { draft: 0, approved: 0, sent: 0, paid: 0, void: 0, all: 0 };
  for (const r of rows) {
    if (counts[r.status] !== undefined) counts[r.status] = r.count;
    counts.all += r.count;
  }
  counts.pending = counts.draft + counts.approved;
  res.json({ counts });
});

// GET /api/invoices
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let rows;
  if (status === 'pending') {
    rows = db.prepare(`SELECT * FROM invoices WHERE status IN ('draft','approved') ORDER BY created_at DESC`).all();
  } else if (status) {
    rows = db.prepare('SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  }
  res.json({ invoices: rows.map(rowToInvoice) });
});

// POST /api/invoices — create draft from transport (auto-populate)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  const { transportId, overrides = {} } = req.body;
  if (!transportId) return res.status(400).json({ error: 'transportId is required' });

  const db = getDb();
  const preview = buildPreviewData(db, transportId);
  if (!preview) return res.status(404).json({ error: 'Transport not found' });

  // Apply any admin overrides on top of auto-populated data
  const d = { ...preview, ...overrides };

  // Assign invoice number
  const invoiceNumber = nextInvoiceNumber(db);

  // Recalculate line items if fees were overridden
  let lineItems = d.lineItems;
  if (overrides.pickupFee !== undefined || overrides.mileageFee !== undefined || overrides.obFee !== undefined) {
    const fakeT = {
      pickup_fee: overrides.pickupFee !== undefined ? overrides.pickupFee : preview.pickupFee,
      mileage_fee: overrides.mileageFee !== undefined ? overrides.mileageFee : preview.mileageFee,
      ob_fee: overrides.obFee !== undefined ? overrides.obFee : preview.obFee,
      actual_miles: overrides.actualMiles !== undefined ? overrides.actualMiles : preview.actualMiles,
      pickup_location: preview.pickupLocation,
    };
    lineItems = buildLineItems(fakeT);
    // Always use admin fee of 10 unless overridden
    const adminFeeOverride = overrides.adminFee !== undefined ? parseFloat(overrides.adminFee) : 10;
    const lastItem = lineItems[lineItems.length - 1];
    if (lastItem && lastItem.description === 'Administration Fee') {
      lastItem.unit_price = adminFeeOverride;
      lastItem.amount = adminFeeOverride;
    }
  }

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const total = subtotal;

  const result = db.prepare(`
    INSERT INTO invoices (
      transport_id, invoice_number,
      funeral_home_name, funeral_home_email, decedent_name, decedent_dob,
      case_number, pickup_fee, mileage_fee, ob_fee, admin_fee, total_cost,
      actual_miles, notes, status, payment_status,
      service_date, issue_date, due_date,
      pickup_location, delivery_location, bill_to_location,
      customer_name_full, customer_street, customer_city, customer_state, customer_zip,
      line_items
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    transportId,
    invoiceNumber,
    d.funeralHomeName || null,
    d.funeralHomeEmail || null,
    d.decedentName || null,
    d.decedentDob || null,
    d.caseNumber || null,
    parseFloat(d.pickupFee) || 0,
    parseFloat(d.mileageFee) || 0,
    parseFloat(d.obFee) || 0,
    10,
    total,
    parseInt(d.actualMiles) || 0,
    d.notes || null,
    'draft',
    'due',
    d.serviceDate || null,
    d.issueDate || null,
    d.dueDate || null,
    d.pickupLocation || null,
    d.deliveryLocation || null,
    d.billToLocation || null,
    d.customerNameFull || null,
    d.customerStreet || null,
    d.customerCity || null,
    d.customerState || null,
    d.customerZip || null,
    JSON.stringify(lineItems)
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
  if (['sent', 'paid', 'void'].includes(inv.status)) return res.status(400).json({ error: `Cannot approve invoice with status: ${inv.status}` });

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
  if (['paid', 'void'].includes(inv.status)) return res.status(400).json({ error: `Cannot send invoice with status: ${inv.status}` });

  const lineItems = inv.line_items ? JSON.parse(inv.line_items) : [];
  const invoiceHtml = buildInvoiceHtml(inv, lineItems);

  const apiKey = process.env.RESEND_API_KEY || 're_DfxCWGDy_H7v4EvaGY6Pzc4VJZE4pDWxe';
  const fromEmail = 'leads@knowlegalleads.com';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `STAT MCS LLC <${fromEmail}>`,
        to: [inv.funeral_home_email],
        subject: `Invoice #${inv.invoice_number} — ${inv.decedent_name || inv.transport_id}`,
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

// PUT /api/invoices/:id/mark-paid — mark invoice as paid
router.put('/:id/mark-paid', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'void') return res.status(400).json({ error: 'Cannot mark a voided invoice as paid' });

  db.prepare(`UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);

  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json({ invoice: rowToInvoice(row) });
});

// PUT /api/invoices/:id/void — void an invoice (admin only)
router.put('/:id/void', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Cannot void a paid invoice' });

  db.prepare(`UPDATE invoices SET status = 'void', voided_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);

  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json({ invoice: rowToInvoice(row) });
});

// PUT /api/invoices/:id — update draft fields
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (['sent', 'paid', 'void'].includes(inv.status)) return res.status(400).json({ error: `Cannot edit invoice with status: ${inv.status}` });

  const {
    funeralHomeName, funeralHomeEmail, decedentName, decedentDob,
    pickupFee, mileageFee, obFee, adminFee, totalCost, actualMiles, notes,
    dueDate, paymentStatus, lineItems
  } = req.body;

  const updates = [], values = [];
  if (funeralHomeName !== undefined) { updates.push('funeral_home_name = ?'); values.push(funeralHomeName); }
  if (funeralHomeEmail !== undefined) { updates.push('funeral_home_email = ?'); values.push(funeralHomeEmail); }
  if (decedentName !== undefined) { updates.push('decedent_name = ?'); values.push(decedentName); }
  if (decedentDob !== undefined) { updates.push('decedent_dob = ?'); values.push(decedentDob); }
  if (pickupFee !== undefined) { updates.push('pickup_fee = ?'); values.push(parseFloat(pickupFee)); }
  if (mileageFee !== undefined) { updates.push('mileage_fee = ?'); values.push(parseFloat(mileageFee)); }
  if (obFee !== undefined) { updates.push('ob_fee = ?'); values.push(parseFloat(obFee)); }
  if (adminFee !== undefined) { updates.push('admin_fee = ?'); values.push(parseFloat(adminFee)); }
  if (totalCost !== undefined) { updates.push('total_cost = ?'); values.push(parseFloat(totalCost)); }
  if (actualMiles !== undefined) { updates.push('actual_miles = ?'); values.push(parseInt(actualMiles)); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
  if (dueDate !== undefined) { updates.push('due_date = ?'); values.push(dueDate); }
  if (paymentStatus !== undefined) { updates.push('payment_status = ?'); values.push(paymentStatus); }
  if (lineItems !== undefined) { updates.push('line_items = ?'); values.push(JSON.stringify(lineItems)); }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json({ invoice: rowToInvoice(row) });
});

module.exports = router;
