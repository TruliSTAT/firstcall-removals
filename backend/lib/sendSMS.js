/**
 * sendSMS.js — Twilio SMS alerts for new transport calls
 * Fire-and-forget: always call without await so it never blocks the API response.
 *
 * TODO (future): Add IVR press-1 flow — use Twilio Programmable Voice to call
 * each number, read the transport details via TTS, and require press-1 to accept
 * the call. If no response, escalate to next number.
 */

const ALERT_NUMBERS = ['+13058774880', '+15617794572', '+12818181669'];
const FROM_NUMBER = '+18064505500';

async function alertNewTransport(transport) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.warn('[SMS] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — skipping SMS alerts');
    return;
  }

  const body = [
    `🚐 FCR NEW CALL`,
    transport.decedentName   ? `Name: ${transport.decedentName}`   : null,
    transport.pickupLocation ? `Pickup: ${transport.pickupLocation}${transport.pickupLocationType ? ` (${transport.pickupLocationType})` : ''}` : null,
    transport.funeralHomeName ? `FH: ${transport.funeralHomeName}` : null,
    transport.caseNumber      ? `Case: ${transport.caseNumber}`    : null,
    `Log in to dispatch.`,
  ].filter(Boolean).join(' | ');

  let twilio;
  try {
    twilio = require('twilio');
  } catch (_) {
    console.warn('[SMS] twilio package not installed — skipping SMS alerts');
    return;
  }

  const client = twilio(accountSid, authToken);

  for (const to of ALERT_NUMBERS) {
    client.messages.create({ from: FROM_NUMBER, to, body })
      .then(msg => console.log(`[SMS] Sent to ${to}: ${msg.sid}`))
      .catch(err => console.error(`[SMS] Failed to ${to}:`, err.message));
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
