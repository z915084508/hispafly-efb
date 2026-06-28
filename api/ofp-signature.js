import crypto from 'node:crypto';

const VAMSYS_ROOT = 'https://vamsys.io/api/v3/pilot';
const SIGNATURE_LIMIT = 500000;

export default async function handler(req, res) {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    assertConfigured();
    const authorization = req.headers.authorization;
    const pilotId = await resolvePilotId(authorization);
    const bookingId = normalizeBookingId(req.query.booking);
    await verifyBooking(authorization, bookingId);
    const row = await readPreferences(pilotId);
    const preferences = row?.preferences || {};
    const signatures = isPlainObject(preferences.ofpSignatures) ? preferences.ofpSignatures : {};

    if (req.method === 'GET') {
      const entry = signatures[bookingId];
      return res.status(200).json({
        data: entry?.cipher ? JSON.parse(decrypt(entry.cipher)) : null,
        updatedAt: entry?.updatedAt || null
      });
    }

    if (req.method === 'DELETE') {
      delete signatures[bookingId];
      await writePreferences(pilotId, { ...preferences, ofpSignatures: signatures }, Boolean(row));
      return res.status(200).json({ ok: true });
    }

    const body = normalizeBody(req.body);
    if (!isPlainObject(body.signature) || !Array.isArray(body.signature.strokes)) {
      throw httpError(400, 'invalid_signature', 'A valid OFP signature is required.');
    }
    const serialized = JSON.stringify(body.signature);
    if (serialized.length > SIGNATURE_LIMIT) {
      throw httpError(413, 'signature_too_large', 'The OFP signature is too large to sync.');
    }
    const updatedAt = new Date().toISOString();
    signatures[bookingId] = { cipher: encrypt(serialized), updatedAt };
    trimOldSignatures(signatures, 30);
    await writePreferences(pilotId, { ...preferences, ofpSignatures: signatures }, Boolean(row));
    return res.status(200).json({ ok: true, updatedAt });
  } catch (err) {
    return res.status(Number(err.status) || 500).json({
      error: err.code || 'ofp_signature_sync_failed',
      message: err.message || 'Unable to sync the OFP signature.'
    });
  }
}

function assertConfigured() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SYNC_ENCRYPTION_KEY']
    .filter((name) => !process.env[name]);
  if (missing.length) throw httpError(503, 'sync_not_configured', `Missing ${missing.join(', ')} environment variables.`);
}

async function resolvePilotId(authorization) {
  if (!authorization?.startsWith('Bearer ')) throw httpError(401, 'missing_authorization', 'A vAMSYS access token is required.');
  const response = await fetch(`${VAMSYS_ROOT}/user`, { headers: { Authorization: authorization, Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(401, 'invalid_authorization', 'The vAMSYS login is no longer valid.');
  const user = payload.data || payload;
  const pilotId = user.pilot?.id || user.pilot_id || user.id;
  if (pilotId === undefined || pilotId === null || pilotId === '') throw httpError(502, 'pilot_id_missing', 'vAMSYS did not return a Pilot ID.');
  return String(pilotId);
}

async function verifyBooking(authorization, bookingId) {
  const response = await fetch(`${VAMSYS_ROOT}/bookings/${encodeURIComponent(bookingId)}`, {
    headers: { Authorization: authorization, Accept: 'application/json' }
  });
  if (response.status === 404) throw httpError(404, 'booking_not_found', 'This booking does not belong to the current pilot.');
  if (!response.ok) throw httpError(response.status === 401 ? 401 : 502, 'booking_verification_failed', 'Unable to verify this vAMSYS booking.');
}

async function readPreferences(pilotId) {
  const response = await supabaseRequest(`/rest/v1/pilot_settings?pilot_id=eq.${encodeURIComponent(pilotId)}&select=preferences`, {
    headers: { Accept: 'application/vnd.pgrst.object+json' }
  });
  if (response.status === 406) return null;
  if (!response.ok) throw await supabaseError(response);
  return response.json();
}

async function writePreferences(pilotId, preferences, exists) {
  const path = exists
    ? `/rest/v1/pilot_settings?pilot_id=eq.${encodeURIComponent(pilotId)}`
    : '/rest/v1/pilot_settings';
  const response = await supabaseRequest(path, {
    method: exists ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ pilot_id: pilotId, preferences, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw await supabaseError(response);
}

function supabaseRequest(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) }
  });
}

async function supabaseError(response) {
  const payload = await response.json().catch(() => ({}));
  return httpError(502, 'database_error', payload.message || `Supabase returned HTTP ${response.status}.`);
}

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.SYNC_ENCRYPTION_KEY).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  const [version, ivText, tagText, encryptedText] = String(value || '').split('.');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) throw httpError(500, 'invalid_signature_data', 'Stored signature data is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
}

function trimOldSignatures(signatures, limit) {
  const entries = Object.entries(signatures).sort((a, b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || '')));
  entries.slice(limit).forEach(([id]) => delete signatures[id]);
}

function normalizeBookingId(value) {
  const id = String(value || '').trim();
  if (!/^\d{1,20}$/.test(id)) throw httpError(400, 'invalid_booking_id', 'A numeric booking ID is required.');
  return id;
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
