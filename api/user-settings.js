import crypto from "node:crypto";

const VAMSYS_USER_URL = "https://vamsys.io/api/v3/pilot/user";

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    assertConfigured();
    const pilotId = await resolvePilotId(req.headers.authorization);

    if (req.method === 'GET') {
      const row = await readSettings(pilotId);
      return res.status(200).json({
        data: row ? {
          telex: { logonCode: decrypt(row.telex_logon_cipher) },
          preferences: row.preferences || {},
          updatedAt: row.updated_at || null
        } : null
      });
    }

    const body = normalizeBody(req.body);
    const logonCode = String(body.telex?.logonCode || '').trim().slice(0, 500);
    const preferences = isPlainObject(body.preferences) ? body.preferences : {};
    await writeSettings(pilotId, {
      telex_logon_cipher: logonCode ? encrypt(logonCode) : null,
      preferences
    });
    return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    const status = Number(err.status) || 500;
    return res.status(status).json({
      error: err.code || 'settings_sync_failed',
      message: err.message || 'Unable to sync settings.'
    });
  }
}

function assertConfigured() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SYNC_ENCRYPTION_KEY']
    .filter((name) => !process.env[name]);
  if (missing.length) {
    throw httpError(503, 'sync_not_configured', `Missing ${missing.join(', ')} environment variables.`);
  }
}

async function resolvePilotId(authorization) {
  if (!authorization?.startsWith('Bearer ')) {
    throw httpError(401, 'missing_authorization', 'A vAMSYS access token is required.');
  }
  const upstream = await fetch(VAMSYS_USER_URL, {
    headers: { Authorization: authorization, Accept: 'application/json' }
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    throw httpError(401, 'invalid_authorization', 'The vAMSYS login is no longer valid.');
  }
  const user = payload.data || payload;
  const pilotId = user.pilot?.id || user.pilot_id || user.id;
  if (pilotId === undefined || pilotId === null || pilotId === '') {
    throw httpError(502, 'pilot_id_missing', 'vAMSYS did not return a Pilot ID.');
  }
  return String(pilotId);
}

async function readSettings(pilotId) {
  const response = await supabaseRequest(`/rest/v1/pilot_settings?pilot_id=eq.${encodeURIComponent(pilotId)}&select=telex_logon_cipher,preferences,updated_at`, {
    headers: { Accept: 'application/vnd.pgrst.object+json' }
  });
  if (response.status === 406) return null;
  if (!response.ok) throw await supabaseError(response);
  return response.json();
}

async function writeSettings(pilotId, settings) {
  const response = await supabaseRequest('/rest/v1/pilot_settings?on_conflict=pilot_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      pilot_id: pilotId,
      ...settings,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw await supabaseError(response);
}

function supabaseRequest(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
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
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  if (!value) return '';
  const [version, ivText, tagText, encryptedText] = String(value).split('.');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
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
