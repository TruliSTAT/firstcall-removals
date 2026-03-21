const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb, rowToTransport } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { alertNewTransport } = require('../lib/sendSMS');
const PDFDocument = require('pdfkit');

function fuzzyMatchFuneralHome(query, homes) {
  if (!query || !homes.length) return null;
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  let best = null, bestScore = 0;
  for (const home of homes) {
    const n = home.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    let score = 0;
    if (n === q) score = 1.0;
    else if (n.includes(q) || q.includes(n)) score = 0.8;
    else {
      const qWords = q.split(/\s+/).filter(w => w.length > 2);
      const nWords = n.split(/\s+/);
      const overlap = qWords.filter(w => nWords.some(nw => nw.includes(w) || w.includes(nw))).length;
      if (qWords.length > 0) score = overlap / Math.max(qWords.length, nWords.length);
    }
    if (score > bestScore) { bestScore = score; best = home; }
  }
  return bestScore >= 0.5 ? best : null;
}

function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const profilePath = path.join(process.env.HOME, '.openclaw/agents/main/agent/auth-profiles.json');
    const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    return data?.profiles?.['anthropic:manual']?.token || null;
  } catch (_) {
    return null;
  }
}

function regexExtract(text) {
  const fields = {
    decedent_name: null, date_of_birth: null, date_of_death: null,
    weight: null, pickup_location: null, pickup_location_type: null,
    pickup_contact: null, pickup_phone: null, destination: null,
    destination_location_type: null, destination_contact: null, destination_phone: null,
    funeral_home_name: null, funeral_home_phone: null, case_number: null,
    estimated_miles: null, notes: null, date: null
  };

  // Decedent name
  const namePatterns = [
    /(?:decedent|transport for|for|name)[:\s]+([A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+)/i,
    /(?:^|\n)([A-Z][a-z]+ [A-Z][a-z]+)\s+DOB/m
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m) { fields.decedent_name = m[1].trim(); break; }
  }

  // DOB
  const dobMatch = text.match(/(?:DOB|date of birth|born)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
  if (dobMatch) {
    const parts = dobMatch[1].split(/[\/\-]/);
    fields.date_of_birth = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  }

  // Date of death
  const dodMatch = text.match(/(?:passed|died|date of death|DOD)[:\s,]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
  if (dodMatch) {
    const parts = dodMatch[1].split(/[\/\-]/);
    fields.date_of_death = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  }

  // Weight
  const weightMatch = text.match(/(?:weight|approx\.?|approximately)?\s*(\d+)\s*(?:lbs?|pounds?)/i);
  if (weightMatch) fields.weight = parseInt(weightMatch[1]);

  // Phone numbers (capture multiple)
  const phones = [];
  const phoneRe = /(?:\+?1[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})/g;
  let pm;
  while ((pm = phoneRe.exec(text)) !== null) {
    phones.push(`${pm[1]}-${pm[2]}-${pm[3]}`);
  }
  if (phones[0]) fields.pickup_phone = phones[0];
  if (phones[1]) fields.funeral_home_phone = phones[1];

  // Case number
  const caseMatch = text.match(/(?:case\s*(?:#|number|no\.?)?|ref(?:erence)?)[:\s#]+([A-Z0-9\-]+)/i);
  if (caseMatch) fields.case_number = caseMatch[1].trim();

  // Pickup location type detection
  const text_lower = text.toLowerCase();
  if (text_lower.includes('hospital') || text_lower.includes('medical center')) fields.pickup_location_type = 'Hospital';
  else if (text_lower.includes('nursing home') || text_lower.includes('nursing facility')) fields.pickup_location_type = 'Nursing Home';
  else if (text_lower.includes('residence') || text_lower.includes('home')) fields.pickup_location_type = 'Residential';
  else if (text_lower.includes('funeral home') || text_lower.includes('mortuary')) fields.pickup_location_type = 'Funeral Home/Care Center';
  else if (text_lower.includes('hospice')) fields.pickup_location_type = 'Hospice';

  // Miles
  const milesMatch = text.match(/(\d+)\s*miles?/i);
  if (milesMatch) fields.estimated_miles = parseInt(milesMatch[1]);

  return fields;
}

const router = express.Router();

// Status transition map: what comes next
const NEXT_STATUS = {
  'Pending':   'Accepted',
  'Accepted':  'En Route',
  'En Route':  'Arrived',
  'Arrived':   'Loaded',
  'Loaded':    'Completed',
};

// Which timestamp column to set for each status
const STATUS_TIMESTAMP = {
  'Accepted':  'accepted_at',
  'En Route':  'en_route_at',
  'Arrived':   'arrived_at',
  'Loaded':    'loaded_at',
  'Completed': 'completed_at',
};

// Human-readable notification messages for each transition
const STATUS_MESSAGES = {
  'Accepted':  (driver) => `Your transport has been accepted${driver ? ` and driver ${driver} has been assigned` : ''}.`,
  'En Route':  (driver) => `${driver ? `Driver ${driver}` : 'Your driver'} is now EN ROUTE to your pickup location.`,
  'Arrived':   (driver) => `${driver ? `Driver ${driver}` : 'Your driver'} has ARRIVED at the pickup location.`,
  'Loaded':    (_driver) => `Decedent has been LOADED. Transport is underway.`,
  'Completed': (_driver) => `Transport has been COMPLETED. Delivery confirmed.`,
};

function calculateCost(pickupType, weight, miles) {
  const pickupFee = pickupType === 'Residential' ? 225
    : pickupType === 'Funeral Home/Care Center' ? 175 : 195;

  const mileageFee = miles > 30 ? (miles - 30) * 3.50 : 0;

  let obFee = 0;
  if (weight > 250) {
    obFee = 50 + Math.floor((weight - 250) / 100) * 50;
  }

  const adminFee = 10;
  const totalCost = pickupFee + mileageFee + obFee + adminFee;

  return { pickupFee, mileageFee, obFee, adminFee, totalCost };
}

function generateId(prefix) {
  return prefix + Date.now().toString().slice(-6);
}

function getTransportWithNames(db, id) {
  return db.prepare(`
    SELECT t.*,
      d.name as driver_name,
      v.name as vehicle_name
    FROM transports t
    LEFT JOIN drivers d ON t.assigned_driver_id = d.id
    LEFT JOIN vehicles v ON t.assigned_vehicle_id = v.id
    WHERE t.id = ?
  `).get(id);
}

function createNotification(db, transportId, forUserId, message) {
  if (!forUserId) return;
  db.prepare(
    'INSERT INTO notifications (transport_id, for_user_id, message) VALUES (?, ?, ?)'
  ).run(transportId, forUserId, message);
}

// POST /api/transports/parse-intake — AI-powered text extraction
router.post('/parse-intake', authenticateToken, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = getAnthropicKey();
  if (apiKey) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const systemPrompt = `You are a data extraction assistant for a funeral transport company. Extract structured transport request information from the provided text and return ONLY valid JSON. Do not include any explanation or markdown.`;
      const userPrompt = `Extract transport information from the text below. Return a JSON object with exactly these two keys: "fields" and "confidence".

"fields" should contain:
- decedent_name: full name of the deceased (string or null)
- date_of_birth: in YYYY-MM-DD format (string or null)
- date_of_death: in YYYY-MM-DD format (string or null)
- weight: weight in pounds as a number (number or null)
- pickup_location: full pickup address (string or null)
- pickup_location_type: one of exactly: Hospital, Residential, Nursing Home, ALF, Funeral Home/Care Center, State Facility, Hospice, MEO/Lab (string or null)
- pickup_contact: contact person name at pickup (string or null)
- pickup_phone: phone number at pickup location (string or null)
- destination: full destination address (string or null)
- destination_location_type: one of exactly: Hospital, Residential, Nursing Home, ALF, Funeral Home/Care Center, State Facility, Hospice, MEO/Lab (string or null)
- destination_contact: contact person name at destination (string or null)
- destination_phone: phone number at destination (string or null)
- funeral_home_name: name of funeral home (string or null)
- funeral_home_phone: funeral home phone number (string or null)
- case_number: case or reference number (string or null)
- estimated_miles: estimated miles as a number (number or null)
- notes: any relevant info not captured above (string or null)
- date: transport date in YYYY-MM-DD format (string or null)

"confidence" should map each field name to "high" (clearly stated), "medium" (inferred), or "low" (uncertain). Use null for fields not found.

Text to parse:
${text}`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const content = message.content[0].text.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const db = getDb();
        const homes = db.prepare('SELECT * FROM funeral_homes WHERE deleted_at IS NULL').all();
        const matched = fuzzyMatchFuneralHome(parsed.fields?.funeral_home_name, homes);
        if (matched) {
          parsed.matched_funeral_home = {
            id: matched.id,
            name: matched.name,
            default_destination: matched.default_destination,
            intake_format: matched.intake_format,
          };
        }
        return res.json(parsed);
      }
    } catch (err) {
      console.error('Anthropic parse-intake error:', err.message);
    }
  }

  // Regex fallback
  const fields = regexExtract(text);
  const confidence = {};
  for (const key of Object.keys(fields)) {
    confidence[key] = fields[key] !== null ? 'medium' : null;
  }
  const db = getDb();
  const homes = db.prepare('SELECT * FROM funeral_homes WHERE deleted_at IS NULL').all();
  const matched = fuzzyMatchFuneralHome(fields.funeral_home_name, homes);
  const result = { fields, confidence };
  if (matched) {
    result.matched_funeral_home = {
      id: matched.id,
      name: matched.name,
      default_destination: matched.default_destination,
      intake_format: matched.intake_format,
    };
  }
  return res.json(result);
});

// GET /api/transports
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  let rows;

  if (req.user.role === 'funeral_home') {
    rows = db.prepare(`
      SELECT t.*, d.name as driver_name, v.name as vehicle_name
      FROM transports t
      LEFT JOIN drivers d ON t.assigned_driver_id = d.id
      LEFT JOIN vehicles v ON t.assigned_vehicle_id = v.id
      WHERE t.created_by_user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT t.*, d.name as driver_name, v.name as vehicle_name
      FROM transports t
      LEFT JOIN drivers d ON t.assigned_driver_id = d.id
      LEFT JOIN vehicles v ON t.assigned_vehicle_id = v.id
      ORDER BY t.created_at DESC
    `).all();
  }

  res.json({ transports: rows.map(rowToTransport) });
});

// POST /api/transports
router.post('/', authenticateToken, (req, res) => {
  const {
    pickupLocation, pickupLocationType, destination, destinationLocationType,
    decedentName, dateOfBirth, dateOfDeath, weight, funeralHomeName, funeralHomePhone,
    pickupContact, pickupPhone, destinationContact, destinationPhone,
    caseNumber, estimatedMiles, notes, funeralHomeId, scheduledPickupAt, assignedUserId
  } = req.body;

  const w = parseInt(weight) || 0;
  const m = parseInt(estimatedMiles) || 0;
  const cost = calculateCost(pickupLocationType, w, m);
  const id = generateId('REQ');
  const date = new Date().toISOString().split('T')[0];
  const fhId = funeralHomeId ? parseInt(funeralHomeId) : null;
  // Allow admin to link transport to a specific funeral home user
  const createdBy = (assignedUserId && req.user.role === 'admin') ? parseInt(assignedUserId) : req.user.id;

  const db = getDb();

  // Auto-generate case number if not provided: FCR-YYYYMMDD-NNNN
  let finalCaseNumber = (caseNumber || '').trim() || null;
  if (!finalCaseNumber) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { dayCount } = db.prepare(
      `SELECT COUNT(*) as dayCount FROM transports WHERE date = ?`
    ).get(date);
    const seq = String(dayCount + 1).padStart(4, '0');
    finalCaseNumber = `FCR-${today}-${seq}`;
  }

  db.prepare(`
    INSERT INTO transports (
      id, date, pickup_location, pickup_location_type, destination, destination_location_type,
      decedent_name, date_of_birth, date_of_death, weight, funeral_home_name, funeral_home_phone,
      pickup_contact, pickup_phone, destination_contact, destination_phone,
      case_number, estimated_miles, status, notes,
      pickup_fee, mileage_fee, ob_fee, admin_fee, total_cost,
      created_by_user_id, funeral_home_id, scheduled_pickup_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?,
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id, date,
    pickupLocation || null, pickupLocationType || null, destination || null, destinationLocationType || null,
    decedentName || null, dateOfBirth || null, dateOfDeath || null, w,
    funeralHomeName || null, funeralHomePhone || null,
    pickupContact || null, pickupPhone || null, destinationContact || null, destinationPhone || null,
    finalCaseNumber, m,
    notes || null,
    cost.pickupFee, cost.mileageFee, cost.obFee, cost.adminFee, cost.totalCost,
    createdBy, fhId, scheduledPickupAt || null
  );

  const row = getTransportWithNames(db, id);
  const created = rowToTransport(row);

  // Fire-and-forget SMS alert to dispatch team + all available drivers
  alertNewTransport(created, db);

  res.status(201).json({ transport: created });
});

// PUT /api/transports/:id/assign — Admin driver & vehicle assignment
router.put('/:id/assign', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { driverId, vehicleId } = req.body;

  if (!driverId && !vehicleId) {
    return res.status(400).json({ error: 'At least one of driverId or vehicleId is required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM transports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transport not found' });

  const updates = [];
  const values = [];

  if (driverId !== undefined) { updates.push('assigned_driver_id = ?'); values.push(driverId); }
  if (vehicleId !== undefined) { updates.push('assigned_vehicle_id = ?'); values.push(vehicleId); }

  // Auto-advance Pending → Accepted
  const wasAccepted = existing.status === 'Pending';
  if (wasAccepted) {
    updates.push('status = ?'); values.push('Accepted');
    updates.push('accepted_at = ?'); values.push(new Date().toISOString());
  }

  // Update driver/vehicle statuses
  if (driverId) {
    db.prepare("UPDATE drivers SET status = 'Active' WHERE id = ?").run(driverId);
    // Free previous driver if reassigning
    if (existing.assigned_driver_id && existing.assigned_driver_id !== driverId) {
      const stillUsed = db.prepare(
        "SELECT COUNT(*) as c FROM transports WHERE assigned_driver_id = ? AND status NOT IN ('Completed') AND id != ?"
      ).get(existing.assigned_driver_id, id);
      if (!stillUsed.c) db.prepare("UPDATE drivers SET status = 'Available' WHERE id = ?").run(existing.assigned_driver_id);
    }
  }
  if (vehicleId) {
    const assignedDriver = driverId || existing.assigned_driver_id;
    db.prepare("UPDATE vehicles SET status = 'In Use', driver_id = ? WHERE id = ?").run(assignedDriver || null, vehicleId);
    // Free previous vehicle if reassigning
    if (existing.assigned_vehicle_id && existing.assigned_vehicle_id !== vehicleId) {
      const stillUsed = db.prepare(
        "SELECT COUNT(*) as c FROM transports WHERE assigned_vehicle_id = ? AND status NOT IN ('Completed') AND id != ?"
      ).get(existing.assigned_vehicle_id, id);
      if (!stillUsed.c) db.prepare("UPDATE vehicles SET status = 'Available', driver_id = NULL WHERE id = ?").run(existing.assigned_vehicle_id);
    }
  }

  values.push(id);
  db.prepare(`UPDATE transports SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Notification: driver + vehicle assignment
  if (existing.created_by_user_id) {
    const effectiveDriverId = driverId || existing.assigned_driver_id;
    const effectiveVehicleId = vehicleId || existing.assigned_vehicle_id;
    let driverName = null, vehicleName = null;
    if (effectiveDriverId) {
      const d = db.prepare('SELECT name FROM drivers WHERE id = ?').get(effectiveDriverId);
      if (d) driverName = d.name;
    }
    if (effectiveVehicleId) {
      const v = db.prepare('SELECT name FROM vehicles WHERE id = ?').get(effectiveVehicleId);
      if (v) vehicleName = v.name;
    }
    const msg = driverName && vehicleName
      ? `Driver ${driverName} in ${vehicleName} has been assigned to your transport.`
      : driverName
        ? `Driver ${driverName} has been assigned to your transport.`
        : `A vehicle has been assigned to your transport.`;
    createNotification(db, id, existing.created_by_user_id, msg);
  }

  const row = getTransportWithNames(db, id);
  res.json({ transport: rowToTransport(row) });
});

// PUT /api/transports/:id
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM transports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transport not found' });

  const {
    status, assignedDriverId, assignedVehicleId, currentLocation, returnTo,
    actualMiles, pickupLocation, pickupLocationType, destination, destinationLocationType,
    decedentName, dateOfBirth, dateOfDeath, weight, funeralHomeName, funeralHomePhone,
    pickupContact, pickupPhone, destinationContact, destinationPhone, caseNumber, estimatedMiles,
    notes, eta, scheduledPickupAt
  } = req.body;

  const updates = [];
  const values = [];

  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (assignedDriverId !== undefined) { updates.push('assigned_driver_id = ?'); values.push(assignedDriverId); }
  if (assignedVehicleId !== undefined) { updates.push('assigned_vehicle_id = ?'); values.push(assignedVehicleId); }
  if (currentLocation !== undefined) { updates.push('current_location = ?'); values.push(currentLocation); }
  if (returnTo !== undefined) { updates.push('return_to = ?'); values.push(returnTo); }
  if (actualMiles !== undefined) { updates.push('actual_miles = ?'); values.push(actualMiles); }
  if (pickupLocation !== undefined) { updates.push('pickup_location = ?'); values.push(pickupLocation); }
  if (pickupLocationType !== undefined) { updates.push('pickup_location_type = ?'); values.push(pickupLocationType); }
  if (destination !== undefined) { updates.push('destination = ?'); values.push(destination); }
  if (destinationLocationType !== undefined) { updates.push('destination_location_type = ?'); values.push(destinationLocationType); }
  if (decedentName !== undefined) { updates.push('decedent_name = ?'); values.push(decedentName); }
  if (dateOfBirth !== undefined) { updates.push('date_of_birth = ?'); values.push(dateOfBirth); }
  if (dateOfDeath !== undefined) { updates.push('date_of_death = ?'); values.push(dateOfDeath); }
  if (weight !== undefined) { updates.push('weight = ?'); values.push(weight); }
  if (funeralHomeName !== undefined) { updates.push('funeral_home_name = ?'); values.push(funeralHomeName); }
  if (funeralHomePhone !== undefined) { updates.push('funeral_home_phone = ?'); values.push(funeralHomePhone); }
  if (pickupContact !== undefined) { updates.push('pickup_contact = ?'); values.push(pickupContact); }
  if (pickupPhone !== undefined) { updates.push('pickup_phone = ?'); values.push(pickupPhone); }
  if (destinationContact !== undefined) { updates.push('destination_contact = ?'); values.push(destinationContact); }
  if (destinationPhone !== undefined) { updates.push('destination_phone = ?'); values.push(destinationPhone); }
  if (caseNumber !== undefined) { updates.push('case_number = ?'); values.push(caseNumber); }
  if (estimatedMiles !== undefined) { updates.push('estimated_miles = ?'); values.push(estimatedMiles); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
  if (eta !== undefined) { updates.push('eta = ?'); values.push(eta); }
  if (scheduledPickupAt !== undefined) { updates.push('scheduled_pickup_at = ?'); values.push(scheduledPickupAt); }

  // Set status transition timestamps
  if (status && STATUS_TIMESTAMP[status]) {
    const tsCol = STATUS_TIMESTAMP[status];
    updates.push(`${tsCol} = ?`);
    values.push(new Date().toISOString());
  }

  // When assigning driver/vehicle, update their status
  if (assignedDriverId) {
    db.prepare("UPDATE drivers SET status = 'Active' WHERE id = ?").run(assignedDriverId);
    if (assignedVehicleId) {
      db.prepare("UPDATE vehicles SET status = 'In Use', driver_id = ? WHERE id = ?").run(assignedDriverId, assignedVehicleId);
    }
  }

  // When completing, free up driver/vehicle
  if (status === 'Completed') {
    if (existing.assigned_driver_id) {
      db.prepare("UPDATE drivers SET status = 'Available' WHERE id = ?").run(existing.assigned_driver_id);
    }
    if (existing.assigned_vehicle_id) {
      db.prepare("UPDATE vehicles SET status = 'Available', driver_id = NULL WHERE id = ?").run(existing.assigned_vehicle_id);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  db.prepare(`UPDATE transports SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Create notification for the originating funeral home on status changes
  if (status && STATUS_MESSAGES[status] && existing.created_by_user_id) {
    // Get current driver name for the message
    const driverId = assignedDriverId || existing.assigned_driver_id;
    let driverName = null;
    if (driverId) {
      const d = db.prepare('SELECT name FROM drivers WHERE id = ?').get(driverId);
      if (d) driverName = d.name;
    }
    const msg = STATUS_MESSAGES[status](driverName);
    createNotification(db, id, existing.created_by_user_id, msg);
  }

  const row = getTransportWithNames(db, id);
  const updated = rowToTransport(row);

  // Always notify Tommy of every status change on every call
  if (status && status !== existing.status) {
    const { sendDriverSMS } = require('../lib/sendSMS');
    const driverId = assignedDriverId || existing.assigned_driver_id;
    let driverName = 'Unassigned';
    if (driverId) {
      const d = db.prepare('SELECT name FROM drivers WHERE id = ?').get(driverId);
      if (d) driverName = d.name;
    }
    const statusMsg = [
      `📍 FCR STATUS UPDATE`,
      `Case: ${updated.caseNumber || existing.case_number || 'N/A'}`,
      `${updated.decedentName || existing.decedent_name || 'Unknown'}`,
      `Status: ${status}`,
      `Driver: ${driverName}`,
      updated.funeralHomeName || existing.funeral_home_name ? `FH: ${updated.funeralHomeName || existing.funeral_home_name}` : null,
    ].filter(Boolean).join(' | ');
    sendDriverSMS('+13058774880', statusMsg).catch(() => {});
  }

  res.json({ transport: updated });
});

// POST /api/transports/:id/odometer — log an odometer reading
router.post('/:id/odometer', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { reading_type, odometer, vehicle_id } = req.body;

  if (!reading_type || odometer == null) {
    return res.status(400).json({ error: 'reading_type and odometer are required' });
  }
  if (!['start', 'end', 'day_end'].includes(reading_type)) {
    return res.status(400).json({ error: 'reading_type must be start, end, or day_end' });
  }

  const db = getDb();
  const transport = db.prepare('SELECT * FROM transports WHERE id = ?').get(id);
  if (!transport) return res.status(404).json({ error: 'Transport not found' });

  // Save to odometer_readings
  db.prepare(`
    INSERT INTO odometer_readings (driver_id, vehicle_id, transport_id, reading_type, odometer)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    transport.assigned_driver_id || req.user.username,
    vehicle_id || transport.assigned_vehicle_id || null,
    id, reading_type, parseInt(odometer)
  );

  // Update transport odometer_start / odometer_end
  if (reading_type === 'start') {
    db.prepare('UPDATE transports SET odometer_start = ? WHERE id = ?').run(parseInt(odometer), id);
  } else if (reading_type === 'end') {
    db.prepare('UPDATE transports SET odometer_end = ? WHERE id = ?').run(parseInt(odometer), id);
  }

  const row = getTransportWithNames(db, id);
  res.json({ transport: rowToTransport(row) });
});

// DELETE /api/transports/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM transports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transport not found' });

  db.prepare('DELETE FROM transports WHERE id = ?').run(id);
  res.json({ message: 'Transport deleted' });
});

// ─── Transport Chat ───────────────────────────────────────────────────────────

function canAccessTransport(db, transportId, user) {
  if (user.role === 'admin' || user.role === 'employee') return true;
  const t = db.prepare('SELECT created_by_user_id FROM transports WHERE id = ?').get(transportId);
  return t && t.created_by_user_id === user.id;
}

// GET /api/transports/:id/messages
router.get('/:id/messages', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (!canAccessTransport(db, id, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const messages = db.prepare(
    'SELECT * FROM transport_messages WHERE transport_id = ? ORDER BY created_at ASC'
  ).all(id);
  res.json({ messages });
});

// POST /api/transports/:id/messages
router.post('/:id/messages', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

  const db = getDb();
  if (!canAccessTransport(db, id, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = db.prepare(
    `INSERT INTO transport_messages (transport_id, user_id, username, role, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, req.user.id, req.user.username, req.user.role, message.trim());

  const msg = db.prepare('SELECT * FROM transport_messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: msg });
});

// ─── Transport Documents ──────────────────────────────────────────────────────

// POST /api/transports/:id/documents — save a completed document
router.post('/:id/documents', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { template_name, field_data, signature_data } = req.body;
  if (!template_name || !field_data) {
    return res.status(400).json({ error: 'template_name and field_data are required' });
  }
  const db = getDb();
  const transport = db.prepare('SELECT id FROM transports WHERE id = ?').get(id);
  if (!transport) return res.status(404).json({ error: 'Transport not found' });

  const result = db.prepare(`
    INSERT INTO transport_documents (transport_id, template_name, field_data, signature_data, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, template_name, field_data, signature_data || null, req.user.username);

  const doc = db.prepare('SELECT id, transport_id, template_name, created_at, created_by FROM transport_documents WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ document: doc });
});

// GET /api/transports/calendar — completed + lastYear transports for a given month
router.get('/calendar', authenticateToken, requireRole('admin', 'employee'), (req, res) => {
  const db = getDb();
  const year  = parseInt(req.query.year  || new Date().getFullYear(), 10);
  const month = parseInt(req.query.month || (new Date().getMonth() + 1), 10);

  // Zero-pad for SQL LIKE comparison
  const monthStr     = String(month).padStart(2, '0');
  const lastYear     = year - 1;
  const prefix       = `${year}-${monthStr}`;
  const prefixLast   = `${lastYear}-${monthStr}`;

  const cols = `
    t.id, t.case_number, t.decedent_name, t.funeral_home_name,
    t.pickup_location, t.destination, t.actual_miles, t.total_cost,
    t.completed_at, t.status, t.scheduled_pickup_at,
    i.invoice_number, i.id AS invoice_id
  `;

  const sql = `
    SELECT ${cols}
    FROM transports t
    LEFT JOIN invoices i ON i.transport_id = t.id
    WHERE t.status = 'Completed' AND t.completed_at LIKE ?
  `;

  const current  = db.prepare(sql).all(`${prefix}%`);
  const lastYearRows = db.prepare(sql).all(`${prefixLast}%`);

  res.json({ current, lastYear: lastYearRows });
});

// GET /api/transports/:id/documents — list saved documents
router.get('/:id/documents', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const docs = db.prepare(
    'SELECT id, transport_id, template_name, created_at, created_by FROM transport_documents WHERE transport_id = ? ORDER BY created_at DESC'
  ).all(id);
  res.json({ documents: docs });
});

// DELETE /api/transports/:id/documents/:docId — delete a saved doc (admin only)
router.delete('/:id/documents/:docId', authenticateToken, requireRole('admin'), (req, res) => {
  const { id, docId } = req.params;
  const db = getDb();
  const doc = db.prepare('SELECT id FROM transport_documents WHERE id = ? AND transport_id = ?').get(docId, id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  db.prepare('DELETE FROM transport_documents WHERE id = ?').run(docId);
  res.json({ message: 'Document deleted' });
});

function authenticateTokenOrQuery(req, res, next) {
  const { authenticateToken: authMiddleware, JWT_SECRET } = require('../middleware/auth');
  // Try query param token first
  if (req.query.token) {
    const jwt = require('jsonwebtoken');
    jwt.verify(req.query.token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    });
  } else {
    authMiddleware(req, res, next);
  }
}

// GET /api/transports/:id/summary.pdf — generate transport summary PDF
router.get('/:id/summary.pdf', authenticateTokenOrQuery, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  // Look up transport with driver/vehicle names
  const row = db.prepare(`
    SELECT t.*,
           d.name AS driver_name,
           v.name AS vehicle_name
    FROM transports t
    LEFT JOIN drivers d ON d.id = t.assigned_driver_id
    LEFT JOIN vehicles v ON v.id = t.assigned_vehicle_id
    WHERE t.id = ?
  `).get(id);

  if (!row) return res.status(404).json({ error: 'Transport not found' });

  // FH users can only access their own transports
  if (req.user.role === 'funeral_home' && row.created_by_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const t = rowToTransport(row);
  const caseNum = t.caseNumber || t.id;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="FCR-${caseNum}-summary.pdf"`);

  // Compact single-page layout — tighter margins, smaller fonts, compressed spacing
  const doc = new PDFDocument({ margin: 30, size: 'LETTER', autoFirstPage: true });
  doc.pipe(res);

  const ML = 30;           // margin left
  const W = 555;           // usable width (612 - 30*2 - 3 spare)
  const DARK_GRAY = '#333333';
  const MID_GRAY = '#666666';
  const LIGHT_GRAY = '#999999';
  const BLACK = '#111111';
  const LINE_COLOR = '#dddddd';

  // compact field: label tiny above, value below — row height ~26px
  function writeField(label, value, x, y, fieldWidth) {
    doc.fontSize(6.5).fillColor(LIGHT_GRAY).font('Helvetica').text(label.toUpperCase(), x, y, { width: fieldWidth });
    doc.fontSize(8.5).fillColor(value ? BLACK : LIGHT_GRAY).font(value ? 'Helvetica-Bold' : 'Helvetica')
       .text(value || '—', x, y + 8, { width: fieldWidth, lineBreak: false });
  }

  // section header — slim bar
  function sectionHeader(title, y) {
    doc.rect(ML, y, W, 13).fill('#f0f0f0');
    doc.fontSize(7).fillColor(MID_GRAY).font('Helvetica-Bold').text(title.toUpperCase(), ML + 4, y + 3, { width: W - 8 });
    doc.font('Helvetica');
    return y + 17;
  }

  function hRule(y, color = LINE_COLOR) {
    doc.moveTo(ML, y).lineTo(ML + W, y).lineWidth(0.4).strokeColor(color).stroke();
  }

  // ── Header ──────────────────────────────────────────────────────────────
  doc.fontSize(16).fillColor('#1a1a1a').font('Helvetica-Bold').text('FIRST CALL REMOVALS', ML, 30, { width: 300 });
  doc.fontSize(8).fillColor(LIGHT_GRAY).font('Helvetica').text('Professional Funeral Transport Services', ML, 50);
  // Case info on right
  const dateStr = t.date ? new Date(t.date).toLocaleDateString() : '—';
  doc.fontSize(8).fillColor(DARK_GRAY).font('Helvetica-Bold').text(`Case #: ${caseNum}`, ML + 350, 30, { width: 200, align: 'right' });
  doc.fontSize(8).fillColor(MID_GRAY).font('Helvetica').text(`Date: ${dateStr}   Status: ${t.status}`, ML + 350, 42, { width: 200, align: 'right' });

  hRule(62, '#333333');

  let y = 68;

  // ── Decedent ─────────────────────────────────────────────────────────────
  y = sectionHeader('Decedent', y);
  const col1 = ML, col2 = ML + 180, col3 = ML + 330, col4 = ML + 440;
  writeField('Full Name', t.decedentName, col1, y, 170);
  writeField('Date of Birth', t.dateOfBirth ? new Date(t.dateOfBirth + 'T00:00:00').toLocaleDateString() : null, col2, y, 140);
  writeField('Date of Death', t.dateOfDeath ? new Date(t.dateOfDeath + 'T00:00:00').toLocaleDateString() : null, col3, y, 100);
  writeField('Weight', t.weight ? `${t.weight} lbs` : null, col4, y, 80);
  y += 28;

  // ── Transport ────────────────────────────────────────────────────────────
  y = sectionHeader('Transport', y);
  writeField('Pickup Address', t.pickupLocation, col1, y, 170);
  writeField('Type', t.pickupLocationType, col2, y, 140);
  writeField('Contact', t.pickupContact, col3, y, 110);
  writeField('Phone', t.pickupPhone, col4, y, 100);
  y += 28;
  writeField('Destination', t.destination, col1, y, 170);
  writeField('Type', t.destinationLocationType, col2, y, 140);
  writeField('Contact', t.destinationContact, col3, y, 110);
  writeField('Phone', t.destinationPhone, col4, y, 100);
  y += 28;

  // ── Funeral Home ──────────────────────────────────────────────────────────
  y = sectionHeader('Funeral Home', y);
  writeField('Name', t.funeralHomeName, col1, y, 280);
  writeField('Phone', t.funeralHomePhone, col3, y, 150);
  y += 28;

  // ── Operations ───────────────────────────────────────────────────────────
  y = sectionHeader('Operations', y);
  writeField('Driver', row.driver_name, col1, y, 170);
  writeField('Vehicle', row.vehicle_name, col2, y, 140);
  writeField('Est. Miles', t.estimatedMiles ? `${t.estimatedMiles} mi` : null, col3, y, 100);
  writeField('Actual Miles', t.actualMiles ? `${t.actualMiles} mi` : null, col4, y, 80);
  y += 28;
  writeField('Scheduled', t.scheduledPickupAt ? new Date(t.scheduledPickupAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null, col1, y, 170);
  writeField('Completed', t.completedAt ? new Date(t.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null, col2, y, 140);
  y += 28;

  // ── Timeline ─────────────────────────────────────────────────────────────
  y = sectionHeader('Timeline', y);
  const steps = [
    { label: 'Accepted', ts: t.acceptedAt },
    { label: 'En Route', ts: t.enRouteAt },
    { label: 'Arrived',  ts: t.arrivedAt  },
    { label: 'Loaded',   ts: t.loadedAt   },
    { label: 'Completed',ts: t.completedAt},
  ];
  const stepW = W / 5;
  steps.forEach((step, i) => {
    const sx = ML + i * stepW;
    const tsStr = step.ts ? new Date(step.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    doc.fontSize(6.5).fillColor(MID_GRAY).font('Helvetica-Bold').text(step.label.toUpperCase(), sx, y, { width: stepW - 4 });
    doc.fontSize(8).fillColor(step.ts ? BLACK : LIGHT_GRAY).font('Helvetica').text(tsStr, sx, y + 9, { width: stepW - 4, lineBreak: false });
  });
  y += 28;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (t.notes) {
    y = sectionHeader('Notes', y);
    doc.fontSize(8).fillColor(BLACK).font('Helvetica').text(t.notes, ML, y, { width: W });
    y += Math.min(doc.heightOfString(t.notes, { width: W, fontSize: 8 }), 40) + 8;
  }

  // ── Footer pinned near bottom ──────────────────────────────────────────
  const footerY = doc.page.height - 30;
  hRule(footerY - 10);
  doc.fontSize(7).fillColor(LIGHT_GRAY).text(
    `Generated by FirstCallRemovals.com · ${new Date().toLocaleString()}`,
    ML, footerY - 4, { align: 'center', width: W }
  );

  doc.end();
});

// PUT /api/transports/:id/cancel — admin soft-cancel a transport
router.put('/:id/cancel', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM transports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transport not found' });
  if (existing.status === 'Completed' || existing.status === 'Cancelled') {
    return res.status(400).json({ error: `Cannot cancel a ${existing.status} transport` });
  }
  db.prepare("UPDATE transports SET status = 'Cancelled' WHERE id = ?").run(id);
  const row = db.prepare(`
    SELECT t.*, d.name as driver_name, v.name as vehicle_name
    FROM transports t
    LEFT JOIN drivers d ON t.assigned_driver_id = d.id
    LEFT JOIN vehicles v ON t.assigned_vehicle_id = v.id
    WHERE t.id = ?
  `).get(id);
  // Free up driver/vehicle if assigned
  if (existing.assigned_driver_id) {
    db.prepare("UPDATE drivers SET status = 'Available' WHERE id = ?").run(existing.assigned_driver_id);
  }
  if (existing.assigned_vehicle_id) {
    db.prepare("UPDATE vehicles SET status = 'Available', driver_id = NULL WHERE id = ?").run(existing.assigned_vehicle_id);
  }
  const { rowToTransport } = require('../database');
  res.json({ transport: rowToTransport(row) });
});

module.exports = router;
