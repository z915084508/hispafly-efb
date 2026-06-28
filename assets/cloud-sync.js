const SETTINGS_KEY = 'hpf_telex_settings';
let lastSettings = localStorage.getItem(SETTINGS_KEY) || '{}';
let applyingRemoteSettings = false;
let syncInProgress = false;
let lastRemoteCheck = 0;

export async function startCloudSync() {
  const token = localStorage.getItem('vamsys_token');
  if (!token) return;

  try {
    const response = await requestSettings(token);
    if (response.data?.telex) {
      applyRemoteSettings(response.data);
    }
  } catch (err) {
    console.info('Cloud settings unavailable; local fallback remains active.', err.message);
  }

  window.setInterval(() => syncSettings(token), 3000);
}

async function syncSettings(token) {
  if (syncInProgress) return;
  const current = localStorage.getItem(SETTINGS_KEY) || '{}';
  if (applyingRemoteSettings) return;

  if (current !== lastSettings) {
    await pushLocalSettings(token, current);
    return;
  }

  if (Date.now() - lastRemoteCheck >= 15000) {
    await pullRemoteSettings(token);
  }
}

async function pushLocalSettings(token, current) {
  let telex = {};
  try { telex = JSON.parse(current); } catch { telex = {}; }

  syncInProgress = true;
  try {
    await requestSettings(token, telex);
    lastSettings = current;
    window.dispatchEvent(new CustomEvent('hpf:settings-saved'));
  } catch (err) {
    console.info('Cloud settings save deferred.', err.message);
  } finally {
    syncInProgress = false;
  }
}

async function pullRemoteSettings(token) {
  syncInProgress = true;
  lastRemoteCheck = Date.now();
  try {
    const response = await requestSettings(token);
    if (response.data?.telex) {
      const remote = JSON.stringify(response.data.telex);
      if (remote !== lastSettings) applyRemoteSettings(response.data);
    }
  } catch (err) {
    console.info('Cloud settings refresh deferred.', err.message);
  } finally {
    syncInProgress = false;
  }
}

function applyRemoteSettings(data) {
  applyingRemoteSettings = true;
  lastSettings = JSON.stringify(data.telex || {});
  localStorage.setItem(SETTINGS_KEY, lastSettings);
  window.dispatchEvent(new CustomEvent('hpf:settings-synced', { detail: data }));
  applyingRemoteSettings = false;
}

async function requestSettings(token, telex) {
  const response = await fetch('/api/user-settings', {
    method: telex ? 'PUT' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(telex ? { 'Content-Type': 'application/json' } : {})
    },
    body: telex ? JSON.stringify({ telex }) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || `Settings sync HTTP ${response.status}`);
  return json;
}

startCloudSync();
