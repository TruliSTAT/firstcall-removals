/**
 * sendSMS.js — Twilio SMS alerts for new transport calls
 * Fire-and-forget: always call without await so it never blocks the API response.
 *
 * TODO (future): Add IVR press-1 flow — use Twilio Programmable Voice to call
 * each number, read the transport details via TTS, and require press-1 to accept
 * the call. If no response, escalate to next number.
 */

// Tommy's number — ALWAYS alerted regardless of availability/status
const TOMMY_NUMBER = '+13058774880';
// Other admin alert numbers
const ADMIN_ALERT_NUMBERS = ['+13058774880', '+15617794572', '+12818181669'];
const FROM_NUMBER = '+18064505500';

async function alertNewTransport(transport, db) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.warn('[SMS] TWILIO credentials not set — skipping SMS alerts');
    return;
  }

  let twilio;
  try { twilio = require('twilio'); } catch (_) {
    console.warn('[SMS] twilio not installed'); return;
  }
  const client = twilio(accountSid, authToken);

  const body = [
    `🚐 FCR NEW CALL`,
    transport.decedentName    ? `Name: ${transport.decedentName}`   : null,
    transport.pickupLocation  ? `Pickup: ${transport.pickupLocation}${transport.pickupLocationType ? ` (${transport.pickupLocationType})` : ''}` : null,
    transport.funeralHomeName ? `FH: ${transport.funeralHomeName}`  : null,
    transport.caseNumber      ? `Case: ${transport.caseNumber}`     : null,
    `Log in to accept: firstcallremovals.com`,
  ].filter(Boolean).join(' | ');

  // Build recipient list: admin numbers + available drivers (deduped)
  const recipients = new Set(ADMIN_ALERT_NUMBERS.map(n => n.replace(/\D/g, '')));

  // Add all Available drivers' phone numbers
  if (db) {
    try {
      const availableDrivers = db.prepare(
        `SELECT phone FROM drivers WHERE status = 'Available' AND phone IS NOT NULL AND phone != ''`
      ).all();
      for (const d of availableDrivers) {
        const digits = d.phone.replace(/\D/g, '');
        if (digits.length >= 10) recipients.add(digits);
      }
    } catch (e) {
      console.warn('[SMS] Could not fetch available drivers:', e.message);
    }
  }

  // Send to all recipients
  for (const digits of recipients) {
    const to = `+1${digits.slice(-10)}`;
    client.messages.create({ from: FROM_NUMBER, to, body })
      .then(msg => console.log(`[SMS] Sent to ${to}: ${msg.sid}`))
      .catch(err => console.error(`[SMS] Failed ${to}:`, err.message));
  }
}

async function sendDriverSMS(phone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.warn('[SMS] TWILIO credentials not set — skipping driver SMS');
    return;
  }
  if (!phone) {
    console.warn('[SMS] No phone number for driver — skipping');
    return;
  }

  let twilio;
  try {
    twilio = require('twilio');
  } catch (_) {
    console.warn('[SMS] twilio package not installed — skipping driver SMS');
    return;
  }

  const client = twilio(accountSid, authToken);
  client.messages.create({ from: FROM_NUMBER, to: phone, body: message })
    .then(msg => console.log(`[SMS] Driver SMS sent to ${phone}: ${msg.sid}`))
    .catch(err => console.error(`[SMS] Driver SMS failed to ${phone}:`, err.message));
}

module.exports = { alertNewTransport, sendDriverSMS };
