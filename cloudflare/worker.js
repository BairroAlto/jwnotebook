// Ficheiro gerado. Edita os módulos fonte e volta a executar build-dashboard-worker.mjs.
const { handleReminderRequest, processDueReminders } = (() => {
const REMINDER_FEATURE_KEY = 'ferramenta_agenda_nota';

const NOTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DEVICE_CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_REMINDER_SECONDS = 5 * 365 * 24 * 60 * 60;
const MAX_DEVICE_TOKENS = 8;
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let tablesReady = false;
let tablesPromise = null;
let messagingTokenCache = null;
let messagingTokenPromise = null;

class ReminderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function pemToBytes(pem) {
  const base64 = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw new ReminderError(503, 'A credencial de envio de notificações não está configurada.');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function ensureReminderTables(env) {
  if (tablesReady) return;
  if (tablesPromise) return tablesPromise;

  tablesPromise = env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_label TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
      ON push_subscriptions(user_id, enabled, updated_at)
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        token TEXT UNIQUE,
        device_label TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT '',
        browser TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, client_id)
      )
    `),
    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_devices_user
      ON push_devices(user_id, enabled, last_seen_at)
    `),
    env.DB.prepare(`
      INSERT OR IGNORE INTO push_devices (
        id, user_id, client_id, token, device_label, enabled,
        created_at, last_seen_at, updated_at
      )
      SELECT id, user_id, id, token, device_label, 0,
             created_at, updated_at, updated_at
      FROM push_subscriptions
    `),
    env.DB.prepare(`DELETE FROM push_subscriptions`),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS note_reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        note_id TEXT NOT NULL,
        note_title TEXT NOT NULL DEFAULT '',
        remind_at INTEGER NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER,
        claimed_at INTEGER,
        sent_at INTEGER,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, note_id)
      )
    `),
    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_note_reminders_due
      ON note_reminders(status, remind_at, next_attempt_at)
    `),
    env.DB.prepare(`
      INSERT OR IGNORE INTO feature_access (
        feature_key, label, description, min_plan, active, updated_at
      ) VALUES (?, ?, ?, 'premium', 1, CURRENT_TIMESTAMP)
    `).bind(
      REMINDER_FEATURE_KEY,
      'Agenda da Nota',
      'Lembretes para regressar a uma nota através de notificações da aplicação.'
    )
  ]).then(() => {
    tablesReady = true;
  }).finally(() => {
    tablesPromise = null;
  });

  return tablesPromise;
}

async function getReminderFeature(env) {
  return env.DB.prepare(`
    SELECT feature_key, min_plan, active
    FROM feature_access
    WHERE feature_key = ?
  `).bind(REMINDER_FEATURE_KEY).first();
}

async function assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed) {
  const [feature, entitlement] = await Promise.all([
    getReminderFeature(env),
    getEntitlement(env, uid, request)
  ]);
  if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
    throw new ReminderError(403, 'A Agenda da Nota não está disponível no teu plano atual.');
  }
  return entitlement;
}

function mapReminder(row) {
  if (!row) return null;
  return {
    id: row.id,
    noteId: row.note_id,
    remindAt: Number(row.remind_at),
    timezone: row.timezone || 'UTC',
    status: row.status,
    sentAt: row.sent_at ? Number(row.sent_at) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseNoteId(raw) {
  let noteId = '';
  try {
    noteId = decodeURIComponent(raw || '');
  } catch (_) {
    throw new ReminderError(400, 'Identificador da nota inválido.');
  }
  if (!NOTE_ID_PATTERN.test(noteId)) throw new ReminderError(400, 'Identificador da nota inválido.');
  return noteId;
}

async function assertOwnedLocalNote(uid, noteId, readNote) {
  const note = await readNote(noteId);
  if (!note || note.userId !== uid || note.estado !== 'on' || note.tipo === 'pasta') {
    throw new ReminderError(404, 'Nota não encontrada.');
  }
  return note;
}

async function countActiveDevices(env, uid) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM push_devices
    WHERE user_id = ? AND enabled = 1 AND token IS NOT NULL
  `).bind(uid).first();
  return Number(row?.total || 0);
}

function mapDevice(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    label: row.device_label || 'Dispositivo sem nome',
    platform: row.platform || '',
    browser: row.browser || '',
    enabled: Number(row.enabled) === 1,
    canEnable: Boolean(row.token),
    lastSeenAt: row.last_seen_at || row.updated_at
  };
}

async function legacyClientId(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `legacy-${hex.slice(0, 48)}`;
}

async function registerDevice(env, uid, body) {
  const clientId = text(body.clientId, 128);
  if (!DEVICE_CLIENT_ID_PATTERN.test(clientId)) {
    throw new ReminderError(400, 'Identificador do dispositivo inválido.');
  }

  const token = text(body.token, 4096) || null;
  const deviceLabel = text(body.deviceLabel, 80);
  const platform = text(body.platform, 60);
  const browser = text(body.browser, 60);
  if (token && token.length < 20) throw new ReminderError(400, 'Token de notificações inválido.');

  const existing = await env.DB.prepare(`
    SELECT id FROM push_devices WHERE user_id = ? AND client_id = ?
  `).bind(uid, clientId).first();
  const id = existing?.id || crypto.randomUUID();

  if (token) {
    await env.DB.prepare(`
      UPDATE push_devices
      SET token = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP
      WHERE token = ? AND id <> ?
    `).bind(token, id).run();
  }

  await env.DB.prepare(`
    INSERT INTO push_devices (
      id, user_id, client_id, token, device_label, platform, browser,
      enabled, created_at, last_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, client_id) DO UPDATE SET
      token = COALESCE(excluded.token, push_devices.token),
      device_label = excluded.device_label,
      platform = excluded.platform,
      browser = excluded.browser,
      last_seen_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, uid, clientId, token, deviceLabel, platform, browser).run();

  await env.DB.prepare(`
    DELETE FROM push_devices
    WHERE user_id = ? AND id NOT IN (
      SELECT id FROM push_devices
      WHERE user_id = ?
      ORDER BY last_seen_at DESC
      LIMIT ?
    )
  `).bind(uid, uid, MAX_DEVICE_TOKENS).run();

  const row = await env.DB.prepare(`
    SELECT * FROM push_devices WHERE id = ? AND user_id = ?
  `).bind(id, uid).first();
  return mapDevice(row);
}

async function setDeviceEnabled(env, uid, id, enabled) {
  const device = await env.DB.prepare(`
    SELECT * FROM push_devices WHERE id = ? AND user_id = ?
  `).bind(id, uid).first();
  if (!device) throw new ReminderError(404, 'Dispositivo não encontrado.');
  if (enabled && !device.token) {
    throw new ReminderError(409, 'Abre o NotaBook nesse dispositivo e autoriza primeiro as notificações.');
  }

  await env.DB.prepare(`
    UPDATE push_devices
    SET enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(enabled ? 1 : 0, id, uid).run();

  if (enabled) {
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'pending', next_attempt_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status = 'waiting_device'
    `).bind(uid).run();
  }

  return mapDevice({ ...device, enabled: enabled ? 1 : 0 });
}

async function saveReminder(env, uid, noteId, note, body) {
  const remindAt = Number(body.remindAt);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(remindAt) || remindAt < now + 30 || remindAt > now + MAX_REMINDER_SECONDS) {
    throw new ReminderError(400, 'Escolhe uma data futura válida para o lembrete.');
  }

  const timezone = text(body.timezone || 'UTC', 64);
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(timezone)) {
    throw new ReminderError(400, 'Fuso horário inválido.');
  }

  const id = crypto.randomUUID();
  const status = await countActiveDevices(env, uid) > 0 ? 'pending' : 'waiting_device';
  const title = text(note.nome || note.titulo || 'Nota sem título', 160);

  await env.DB.prepare(`
    INSERT INTO note_reminders (
      id, user_id, note_id, note_title, remind_at, timezone, status,
      attempt_count, next_attempt_at, claimed_at, sent_at, last_error,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, note_id) DO UPDATE SET
      note_title = excluded.note_title,
      remind_at = excluded.remind_at,
      timezone = excluded.timezone,
      status = excluded.status,
      attempt_count = 0,
      next_attempt_at = NULL,
      claimed_at = NULL,
      sent_at = NULL,
      last_error = NULL,
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, uid, noteId, title, remindAt, timezone, status).run();

  return env.DB.prepare(`
    SELECT * FROM note_reminders WHERE user_id = ? AND note_id = ?
  `).bind(uid, noteId).first();
}

async function handleReminderRequest({
  request,
  env,
  uid,
  url,
  json,
  getEntitlement,
  isFeatureAllowed,
  readNote
}) {
  const isReminderRoute = url.pathname.startsWith('/reminders/') || url.pathname.startsWith('/push/');
  if (!isReminderRoute) return null;
  await ensureReminderTables(env);

  if (url.pathname === '/push/config' && request.method === 'GET') {
    await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);
    const vapidKey = text(env.FCM_VAPID_PUBLIC_KEY, 256);
    if (!vapidKey) throw new ReminderError(503, 'A chave pública de notificações ainda não está configurada.');
    return json(request, { vapidKey });
  }

  if (url.pathname === '/push/devices' && request.method === 'GET') {
    await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);
    const result = await env.DB.prepare(`
      SELECT * FROM push_devices
      WHERE user_id = ?
      ORDER BY last_seen_at DESC
      LIMIT ?
    `).bind(uid, MAX_DEVICE_TOKENS).all();
    return json(request, { devices: (result.results || []).map(mapDevice) });
  }

  if (url.pathname === '/push/devices' && request.method === 'POST') {
    await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);
    const body = await request.json().catch(() => ({}));
    const device = await registerDevice(env, uid, body);
    return json(request, { ok: true, device }, 201);
  }

  const deviceId = url.pathname.match(/^\/push\/devices\/([A-Za-z0-9-]{1,80})$/)?.[1];
  if (deviceId && request.method === 'PUT') {
    await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);
    const body = await request.json().catch(() => ({}));
    if (typeof body.enabled !== 'boolean') {
      throw new ReminderError(400, 'Estado do dispositivo inválido.');
    }
    const device = await setDeviceEnabled(env, uid, deviceId, body.enabled);
    return json(request, { ok: true, device });
  }

  if (deviceId && request.method === 'DELETE') {
    await env.DB.prepare(`
      DELETE FROM push_devices WHERE id = ? AND user_id = ?
    `).bind(deviceId, uid).run();
    return json(request, { ok: true });
  }

  // Compatibilidade temporária com clientes anteriores à lista de dispositivos.
  if (url.pathname === '/push/subscriptions' && request.method === 'POST') {
    await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);
    const body = await request.json().catch(() => ({}));
    const token = text(body.token, 4096);
    let clientId = text(body.clientId, 128);
    if (!DEVICE_CLIENT_ID_PATTERN.test(clientId) && token) {
      clientId = await legacyClientId(token);
    }
    const device = await registerDevice(env, uid, { ...body, clientId });
    const activeDevice = await setDeviceEnabled(env, uid, device.id, true);
    return json(request, { ok: true, subscription: activeDevice }, 201);
  }

  const subscriptionId = url.pathname.match(/^\/push\/subscriptions\/([A-Za-z0-9-]{1,80})$/)?.[1];
  if (subscriptionId && request.method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?`).bind(subscriptionId, uid),
      env.DB.prepare(`DELETE FROM push_devices WHERE id = ? AND user_id = ?`).bind(subscriptionId, uid)
    ]);
    return json(request, { ok: true });
  }

  const noteMatch = url.pathname.match(/^\/reminders\/notes\/([^/]+)$/);
  if (!noteMatch) return null;
  const noteId = parseNoteId(noteMatch[1]);

  if (request.method === 'DELETE') {
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'cancelled', claimed_at = NULL, next_attempt_at = NULL,
          last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND note_id = ?
    `).bind(uid, noteId).run();
    return json(request, { ok: true });
  }

  await assertFeatureAllowed(env, uid, request, getEntitlement, isFeatureAllowed);

  if (request.method === 'GET') {
    const row = await env.DB.prepare(`
      SELECT * FROM note_reminders WHERE user_id = ? AND note_id = ?
    `).bind(uid, noteId).first();
    return json(request, { reminder: mapReminder(row) });
  }

  if (request.method === 'PUT') {
    const note = await assertOwnedLocalNote(uid, noteId, readNote);
    const body = await request.json().catch(() => ({}));
    const row = await saveReminder(env, uid, noteId, note, body);
    return json(request, { reminder: mapReminder(row) });
  }

  throw new ReminderError(405, 'Método não permitido.');
}

async function getMessagingAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (messagingTokenCache && messagingTokenCache.expiresAt > now + 60) {
    return messagingTokenCache.token;
  }
  if (messagingTokenPromise) return messagingTokenPromise;

  messagingTokenPromise = (async () => {
    const clientEmail = text(env.FIREBASE_CLIENT_EMAIL, 320);
    const projectId = text(env.FIREBASE_PROJECT_ID, 128);
    if (!clientEmail || !projectId || !env.FIREBASE_PRIVATE_KEY) {
      throw new ReminderError(503, 'As credenciais Firebase do Worker estão incompletas.');
    }

    const header = base64UrlEncodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncodeText(JSON.stringify({
      iss: clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    }));
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(env.FIREBASE_PRIVATE_KEY),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    const assertion = `${header}.${payload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw new ReminderError(502, 'Não foi possível autenticar o envio de notificações.');
    }
    messagingTokenCache = {
      token: data.access_token,
      expiresAt: now + Number(data.expires_in || 3600)
    };
    return messagingTokenCache.token;
  })().finally(() => {
    messagingTokenPromise = null;
  });

  return messagingTokenPromise;
}

function buildReminderUrl(env, noteId) {
  let origin = text(env.APP_ORIGIN || 'https://notabook.site', 300);
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:') throw new Error('Origem insegura');
    origin = parsed.origin;
  } catch (_) {
    origin = 'https://notabook.site';
  }
  const url = new URL('/index.html', origin);
  url.searchParams.set('nota', noteId);
  return url.href;
}

function isInvalidFcmToken(status, data) {
  const code = text(data?.error?.status, 80);
  const details = Array.isArray(data?.error?.details) ? data.error.details : [];
  const errorCode = details.map(item => item?.errorCode).find(Boolean);
  return status === 404 || code === 'NOT_FOUND' || errorCode === 'UNREGISTERED';
}

async function sendFcmReminder(env, accessToken, reminder, subscription) {
  const projectId = text(env.FIREBASE_PROJECT_ID, 128);
  const noteTitle = text(reminder.note_title || 'Nota sem título', 120);
  const payload = {
    message: {
      token: subscription.token,
      data: {
        type: 'note-reminder',
        reminderId: reminder.id,
        noteId: reminder.note_id,
        title: 'Relembrar nota',
        body: `Está na hora de voltares a “${noteTitle}”.`,
        url: buildReminderUrl(env, reminder.note_id)
      },
      webpush: {
        headers: {
          TTL: '86400',
          Urgency: 'high'
        }
      }
    }
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { sent: true, invalidToken: false };
  if (isInvalidFcmToken(response.status, data)) return { sent: false, invalidToken: true };
  throw new Error(text(data?.error?.message || `FCM ${response.status}`, 300));
}

async function markRetry(env, reminder, message) {
  const attempts = Number(reminder.attempt_count || 0) + 1;
  const failed = attempts >= 5;
  const delay = Math.min(3600, 60 * (2 ** Math.min(attempts, 6)));
  await env.DB.prepare(`
    UPDATE note_reminders
    SET status = ?, attempt_count = ?, next_attempt_at = ?, claimed_at = NULL,
        last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `).bind(
    failed ? 'failed' : 'pending',
    attempts,
    failed ? null : Math.floor(Date.now() / 1000) + delay,
    text(message, 300),
    reminder.id
  ).run();
}

async function processReminder(env, reminder, getEntitlement, isFeatureAllowed) {
  const [feature, entitlement] = await Promise.all([
    getReminderFeature(env),
    getEntitlement(env, reminder.user_id)
  ]);
  if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'paused_plan', claimed_at = NULL,
          last_error = 'Plano sem acesso à Agenda da Nota', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'processing'
    `).bind(reminder.id).run();
    return;
  }

  const subscriptions = await env.DB.prepare(`
    SELECT id, token FROM push_devices
    WHERE user_id = ? AND enabled = 1 AND token IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(reminder.user_id, MAX_DEVICE_TOKENS).all();
  const devices = subscriptions.results || [];
  if (!devices.length) {
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'waiting_device', claimed_at = NULL,
          last_error = 'Nenhum dispositivo com notificações ativas', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'processing'
    `).bind(reminder.id).run();
    return;
  }

  const accessToken = await getMessagingAccessToken(env);
  let sent = 0;
  const transientErrors = [];
  for (const subscription of devices) {
    try {
      const result = await sendFcmReminder(env, accessToken, reminder, subscription);
      if (result.sent) sent += 1;
      if (result.invalidToken) {
        await env.DB.prepare(`
          UPDATE push_devices
          SET token = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(subscription.id).run();
      }
    } catch (error) {
      transientErrors.push(error.message || String(error));
    }
  }

  if (sent > 0) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'sent', sent_at = ?, claimed_at = NULL, next_attempt_at = NULL,
          last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'processing'
    `).bind(now, reminder.id).run();
    return;
  }

  const active = await countActiveDevices(env, reminder.user_id);
  if (!active) {
    await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'waiting_device', claimed_at = NULL,
          last_error = 'Os dispositivos deixaram de aceitar notificações', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'processing'
    `).bind(reminder.id).run();
    return;
  }

  await markRetry(env, reminder, transientErrors.join(' · ') || 'Falha temporária no envio');
}

async function processDueReminders({ env, getEntitlement, isFeatureAllowed }) {
  await ensureReminderTables(env);
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    UPDATE note_reminders
    SET status = 'pending', claimed_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing' AND claimed_at < ?
  `).bind(now - 600).run();

  const due = await env.DB.prepare(`
    SELECT * FROM note_reminders
    WHERE status = 'pending'
      AND remind_at <= ?
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY remind_at ASC
    LIMIT 25
  `).bind(now, now).all();

  for (const reminder of due.results || []) {
    const claim = await env.DB.prepare(`
      UPDATE note_reminders
      SET status = 'processing', claimed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).bind(now, reminder.id).run();
    if (Number(claim.meta?.changes || 0) !== 1) continue;

    try {
      await processReminder(env, reminder, getEntitlement, isFeatureAllowed);
    } catch (error) {
      console.error('[REMINDERS] Falha ao processar lembrete:', reminder.id, error);
      await markRetry(env, reminder, error.message || String(error));
    }
  }

  return { processed: (due.results || []).length };
}

return { handleReminderRequest, processDueReminders };
})();

const FREE_QUOTA_BYTES = 3 * 1024 * 1024 * 1024;
const PREMIUM_DEFAULT_QUOTA_BYTES = 25 * 1024 * 1024 * 1024;
const PREMIUM_PLUS_DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024 * 1024;
const SITE_COVER_MAX_BYTES = 10 * 1024 * 1024;
const PUBLIC_SITE_RATE_LIMITS = Object.freeze({
  site: { limit: 90, windowSeconds: 60 },
  cover: { limit: 180, windowSeconds: 60 }
});
const AI_PAID_MODEL = "deepseek/deepseek-chat";
const AI_FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "openai/gpt-oss-20b:free"
];
const AI_FREE_DAILY_LIMIT = 10;
const AI_MONTHLY_LIMITS = { premium: 500, premium_plus: 1000 };
const AI_PAID_LIMITS = { premium: 300, premium_plus: 800 };
const FEATURE_PLAN_RANK = { free: 0, premium: 1, premium_plus: 2 };
const LIMITE_CAIXAS_POR_PLANO = Object.freeze({
  free: 55,
  premium: 110,
  premium_plus: 190
});
const USER_PANEL_FEATURES = [
  ['painel_geral', 'Painel — Avatar', 'Perfil, avatar e identidade visual.'],
  ['painel_planos', 'Painel — Planos', 'Consulta e gestão dos planos da conta.'],
  ['painel_loja', 'Painel — Loja', 'Ferramentas adicionais para instalar na nota.'],
  ['painel_amigos', 'Painel — Amigos', 'Convites e gestão de amizades.'],
  ['painel_definicoes', 'Painel — Definições', 'Preferências da aplicação e da interface.'],
  ['painel_pesquisa', 'Painel — Pesquisa', 'Definições da procura inteligente.'],
  ['painel_manual', 'Painel — Manual', 'Manual de utilização do NotaBook.'],
  ['painel_fusiveis', 'Painel — Fusíveis', 'Interruptores das funcionalidades de Lists.'],
  ['painel_reciclagem', 'Painel — Reciclagem', 'Recuperação e eliminação de conteúdos.'],
  ['painel_sair', 'Painel — Sair', 'Terminar a sessão da conta.']
];
const STORE_FEATURES = [
  ['ferramenta_agenda_nota', 'Agenda da Nota', 'Lembretes para regressar a uma nota através de notificações da aplicação.', 'premium'],
  ['ferramenta_noticias', 'Notícias', 'Ferramenta de notícias RSS disponível na Loja.', 'free'],
  ['ferramenta_tempo', 'Tempo', 'Ferramenta meteorológica com atualização diária disponível na Loja.', 'free'],
  ['ferramenta_inspirador', 'Inspirador', 'Citações da Wikiquote por autor, tema ou aleatórias.', 'free'],
  ['ferramenta_gmail', 'Gmail', 'Consulta os emails recentes da conta Google em modo somente leitura.', 'free'],
  ['ferramenta_habito', 'Hábito', 'Categorias e calendário mensal para acompanhar hábitos.', 'free'],
  ['plug_wikipedia', 'Wikipédia', 'Pesquisa artigos da Wikipédia na coluna EYE.', 'free'],
  ['plug_wikidata', 'Wikidata', 'Pesquisa dados estruturados do Wikidata na coluna EYE.', 'free'],
  ['plug_wikimedia', 'Wikimedia', 'Pesquisa imagens do Wikimedia Commons na coluna EYE.', 'free']
];
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_DAILY_LIMIT = 100;
const PROTECTED_FEATURE_KEYS = new Set([
  ...USER_PANEL_FEATURES.map(([key]) => key),
  ...STORE_FEATURES.map(([key]) => key)
]);

const ALLOWED_ORIGINS = new Set([
  "https://notabook.site",
  "https://www.notabook.site",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

const FIRESTORE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIRESTORE_SITE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
let firestoreTokenCache = null;
let firestoreTokenPromise = null;
let publicRateLimitTableReady = false;
let publicRateLimitLastCleanup = 0;

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

async function ensurePublicRateLimitTable(env) {
  if (publicRateLimitTableReady) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS public_site_rate_limits (
      bucket_key TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    )
  `).run();
  publicRateLimitTableReady = true;
}

async function publicRequestFingerprint(request) {
  const ip = String(request.headers.get("CF-Connecting-IP") || "unknown").trim();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip)
  );
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function assertPublicSiteRateLimit(env, request, type) {
  const policy = PUBLIC_SITE_RATE_LIMITS[type];
  if (!policy) throw new HttpError(500, "Política de pedidos públicos inválida.");

  await ensurePublicRateLimitTable(env);
  const now = Math.floor(Date.now() / 1000);

  if (now - publicRateLimitLastCleanup >= 3600) {
    await env.DB.prepare(`
      DELETE FROM public_site_rate_limits
      WHERE expires_at < ?
    `).bind(now).run();
    publicRateLimitLastCleanup = now;
  }

  const windowStart = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
  const expiresAt = windowStart + policy.windowSeconds + 120;
  const fingerprint = await publicRequestFingerprint(request);
  const bucketKey = `${type}:${windowStart}:${fingerprint}`;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO public_site_rate_limits (
      bucket_key, request_count, expires_at
    ) VALUES (?, 0, ?)
  `).bind(bucketKey, expiresAt).run();

  const reservation = await env.DB.prepare(`
    UPDATE public_site_rate_limits
    SET request_count = request_count + 1
    WHERE bucket_key = ? AND request_count < ?
  `).bind(bucketKey, policy.limit).run();

  if (Number(reservation.meta?.changes || 0) !== 1) {
    throw new HttpError(
      429,
      "Foram feitos demasiados pedidos. Tenta novamente dentro de um minuto.",
      { "Retry-After": String(policy.windowSeconds) }
    );
  }
}

function headersFor(request, extra = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...extra
  });

  const origin = request.headers.get("Origin");
  headers.set("Vary", "Origin");

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, PUT, DELETE, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Plan-Preview, X-Requested-With");
    headers.set("Access-Control-Expose-Headers", "Content-Length, ETag");
  }

  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");

  return headers;
}

function json(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: headersFor(request, extraHeaders)
  });
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function pemToBytes(pem) {
  const base64 = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  if (!base64) throw new HttpError(503, "A credencial do Firestore não está configurada.");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function obterTokenFirestore(env) {
  const agora = Math.floor(Date.now() / 1000);
  if (firestoreTokenCache && firestoreTokenCache.expiraEm > agora + 60) {
    return firestoreTokenCache.token;
  }
  if (firestoreTokenPromise) return firestoreTokenPromise;

  firestoreTokenPromise = (async () => {
    const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
    const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
    const secretsEmFalta = [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !env.FIREBASE_PRIVATE_KEY && "FIREBASE_PRIVATE_KEY"
    ].filter(Boolean);
    if (secretsEmFalta.length) {
      console.error("[SITES] Secrets do Firestore em falta:", secretsEmFalta);
      throw new HttpError(503, "A leitura segura de Sites ainda não está configurada.");
    }

    const cabecalho = base64UrlEncodeText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64UrlEncodeText(JSON.stringify({
      iss: clientEmail,
      scope: FIRESTORE_SCOPE,
      aud: FIRESTORE_TOKEN_URL,
      iat: agora,
      exp: agora + 3600
    }));
    const chave = await crypto.subtle.importKey(
      "pkcs8",
      pemToBytes(env.FIREBASE_PRIVATE_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const assinatura = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      chave,
      new TextEncoder().encode(`${cabecalho}.${payload}`)
    );
    const assertion = `${cabecalho}.${payload}.${base64UrlEncodeBytes(new Uint8Array(assinatura))}`;
    const resposta = await fetch(FIRESTORE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || !dados.access_token) {
      console.error("[SITES] Falha ao obter credencial de leitura do Firestore:", resposta.status);
      throw new HttpError(502, "Não foi possível ler o Site com segurança.");
    }
    firestoreTokenCache = {
      token: dados.access_token,
      expiraEm: agora + Number(dados.expires_in || 3600)
    };
    return firestoreTokenCache.token;
  })().finally(() => {
    firestoreTokenPromise = null;
  });

  return firestoreTokenPromise;
}

function valorFirestore(valor) {
  if (!valor || typeof valor !== "object") return null;
  const tem = (chave) => Object.prototype.hasOwnProperty.call(valor, chave);
  if (tem("nullValue")) return null;
  if (tem("stringValue")) return valor.stringValue;
  if (tem("booleanValue")) return valor.booleanValue === true;
  if (tem("integerValue")) return Number(valor.integerValue);
  if (tem("doubleValue")) return Number(valor.doubleValue);
  if (tem("timestampValue")) return valor.timestampValue;
  if (tem("arrayValue")) {
    return (valor.arrayValue.values || []).map(valorFirestore);
  }
  if (tem("mapValue")) {
    return Object.fromEntries(Object.entries(valor.mapValue.fields || {}).map(([chave, item]) => [chave, valorFirestore(item)]));
  }
  return null;
}

function documentoFirestoreParaObject(documento) {
  return Object.fromEntries(Object.entries(documento?.fields || {}).map(([chave, valor]) => [chave, valorFirestore(valor)]));
}

async function lerDocumentoFirestore(env, coleccao, docId) {
  const token = await obterTokenFirestore(env);
  const projectId = encodeURIComponent(String(env.FIREBASE_PROJECT_ID).trim());
  const caminho = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${coleccao}/${encodeURIComponent(docId)}`;
  const resposta = await fetch(caminho, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (resposta.status === 404) return null;
  if (!resposta.ok) {
    console.error("[SITES] Firestore rejeitou a leitura do Site:", resposta.status);
    throw new HttpError(502, "Não foi possível ler o Site.");
  }
  return documentoFirestoreParaObject(await resposta.json());
}

function textoPublico(valor, limite = 12000) {
  return typeof valor === "string"
    ? valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, limite)
    : "";
}

function numeroPublico(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function sanitizarBairroPublico(bairro) {
  if (!bairro || !Array.isArray(bairro.grupos)) return null;
  const mostrarDataTarefa = bairro.mostrarDataTarefa === true;
  const mostrarDataRealizacaoTarefa = bairro.mostrarDataRealizacaoTarefa === true;
  return {
    mostrarDataTarefa,
    mostrarDataRealizacaoTarefa,
    grupos: bairro.grupos.slice(0, 200).map(grupo => ({
      nome: textoPublico(grupo?.nome, 500),
      tarefas: (Array.isArray(grupo?.tarefas) ? grupo.tarefas : [])
        .filter(tarefa => textoPublico(tarefa?.nome, 500).trim())
        .slice(0, 1000)
        .map(tarefa => ({
          nome: textoPublico(tarefa?.nome, 500),
          concluido: tarefa?.concluido === true,
          criadaEm: mostrarDataTarefa ? numeroPublico(tarefa?.criadaEm) : null,
          realizadaEm: mostrarDataRealizacaoTarefa ? numeroPublico(tarefa?.realizadaEm) : null
        }))
    }))
  };
}

function sanitizarSitePublico(site) {
  const caixas = Array.isArray(site?.caixas) ? site.caixas : [];
  return {
    estado: "on",
    titulo: textoPublico(site?.titulo, 500),
    capaUrl: /^https:\/\//i.test(site?.capaUrl || "") ? String(site.capaUrl).slice(0, 2048) : "",
    capaAltura: ["pequena", "media", "grande"].includes(site?.capaAltura) ? site.capaAltura : "grande",
    largura: site?.largura === "esticada" ? "esticada" : "centralizada",
    mostrarBrowser: site?.mostrarBrowser === true,
    browserIds: (Array.isArray(site?.browserIds) ? site.browserIds : [])
      .map(id => String(id || ""))
      .filter(id => FIRESTORE_SITE_ID_PATTERN.test(id))
      .slice(0, 20),
    caixas: caixas.slice(0, 200).map((caixa, indice) => ({
      tipo: textoPublico(caixa?.tipo, 40),
      titulo: textoPublico(caixa?.titulo, 500),
      conteudo: textoPublico(caixa?.conteudo, 12000),
      ordem: Number.isFinite(Number(caixa?.ordem)) ? Number(caixa.ordem) : indice,
      ...(caixa?.tipo === "bairro" && sanitizarBairroPublico(caixa.bairro)
        ? { bairro: sanitizarBairroPublico(caixa.bairro) }
        : {})
    }))
  };
}

async function obterDocumentoSiteAutorizado(env, docId) {
  const actual = await lerDocumentoFirestore(env, "sites", docId);
  const site = actual || await lerDocumentoFirestore(env, "SitesPublicos", docId);
  if (!site || site.estado !== "on" || !FIRESTORE_SITE_ID_PATTERN.test(String(site.userId || ""))) {
    throw new HttpError(404, "Site não encontrado.");
  }

  const entitlement = await getEntitlement(env, site.userId);
  const feature = await env.DB.prepare(`
    SELECT feature_key, min_plan, active
    FROM feature_access
    WHERE feature_key = ?
  `).bind("sites_publicos").first();
  if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
    throw new HttpError(404, "Site não encontrado.");
  }
  return site;
}

async function obterSiteAutorizado(env, docId) {
  const site = await obterDocumentoSiteAutorizado(env, docId);
  return sanitizarSitePublico(site);
}

async function obterCapaSitePublica(env, request, docId) {
  const site = await obterDocumentoSiteAutorizado(env, docId);
  const fileId = String(site?.capaFileId || "");
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    throw new HttpError(404, "Capa não encontrada.");
  }

  const file = await env.DB.prepare(`
    SELECT object_key, content_type, size_bytes, file_name
    FROM files
    WHERE id = ? AND user_id = ? AND note_id = ?
      AND context_type = 'site' AND context_id = ?
  `).bind(fileId, site.userId, docId, docId).first();
  if (!file || !String(file.content_type || "").toLowerCase().startsWith("image/")) {
    throw new HttpError(404, "Capa não encontrada.");
  }

  const object = await env.FILES.get(file.object_key);
  if (!object) throw new HttpError(404, "Capa não encontrada.");

  return new Response(object.body, {
    headers: headersFor(request, {
      "Content-Type": file.content_type,
      "Content-Length": String(file.size_bytes),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.file_name || "capa")}`
    })
  });
}

function cleanFileName(value) {
  return String(value || "ficheiro")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "ficheiro";
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    throw new HttpError(401, "Sessão não autenticada.");
  }

  const idToken = header.slice(7).trim();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!response.ok) {
    throw new HttpError(401, "Sessão Firebase inválida ou expirada.");
  }

  const data = await response.json();
  const user = data.users?.[0];

  if (!user?.localId || user.disabled === true) {
    throw new HttpError(401, "Utilizador não autorizado.");
  }

  return user.localId;
}

async function ensureGmailTables(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS gmail_connections (
        user_id TEXT PRIMARY KEY,
        google_email TEXT NOT NULL DEFAULT '',
        refresh_token_ciphertext TEXT NOT NULL,
        refresh_token_iv TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS gmail_usage (
        user_id TEXT NOT NULL,
        day_key TEXT NOT NULL,
        messages_read INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, day_key)
      )
    `)
  ]);
}

function gmailBase64Encode(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function gmailBase64Decode(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function gmailEncryptionKey(env) {
  let raw;
  try {
    raw = gmailBase64Decode(env.GMAIL_TOKEN_ENCRYPTION_KEY);
  } catch (_) {
    throw new HttpError(500, "A chave de cifragem do Gmail não está configurada corretamente.");
  }

  if (raw.byteLength !== 32) {
    throw new HttpError(500, "A chave de cifragem do Gmail deve ter 32 bytes em Base64.");
  }

  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function cifrarGmailToken(env, token) {
  const key = await gmailEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token)
  );
  return {
    ciphertext: gmailBase64Encode(ciphertext),
    iv: gmailBase64Encode(iv)
  };
}

async function decifrarGmailToken(env, row) {
  try {
    const key = await gmailEncryptionKey(env);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: gmailBase64Decode(row.refresh_token_iv) },
      key,
      gmailBase64Decode(row.refresh_token_ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch (_) {
    throw new HttpError(500, "Não foi possível abrir a autorização Gmail guardada.");
  }
}

function gmailOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!ALLOWED_ORIGINS.has(origin)) {
    throw new HttpError(403, "A origem desta autorização Gmail não é permitida.");
  }
  return origin;
}

async function assertGmailFeature(env, uid, request) {
  const entitlement = await getEntitlement(env, uid, request);
  const features = await getFeatureRows(env);
  const feature = features.find(item => item.feature_key === "ferramenta_gmail");
  if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
    throw new HttpError(403, "A ferramenta Gmail não está disponível no teu plano.");
  }
}

async function obterLigacaoGmail(env, uid) {
  return env.DB.prepare(`
    SELECT user_id, google_email, refresh_token_ciphertext, refresh_token_iv,
           created_at, updated_at
    FROM gmail_connections
    WHERE user_id = ?
  `).bind(uid).first();
}

async function trocarCodigoGmail(env, request, uid, code) {
  if (!env.GOOGLE_GMAIL_CLIENT_ID || !env.GOOGLE_GMAIL_CLIENT_SECRET) {
    throw new HttpError(500, "A autorização Gmail ainda não está configurada no Worker.");
  }

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_GMAIL_CLIENT_ID,
      client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET,
      redirect_uri: gmailOrigin(request),
      grant_type: "authorization_code"
    })
  });

  const tokenData = await response.json().catch(() => ({}));
  if (!response.ok || !tokenData.access_token) {
    console.error("[GMAIL] Falha na troca do código OAuth", tokenData.error || response.status);
    throw new HttpError(502, "A Google não aceitou a autorização Gmail.");
  }

  const existing = await obterLigacaoGmail(env, uid);
  const refreshToken = tokenData.refresh_token || (existing && await decifrarGmailToken(env, existing));
  if (!refreshToken) {
    throw new HttpError(502, "A Google não devolveu uma autorização persistente para esta conta.");
  }

  const profile = await pedidoGmailWorker("/profile", tokenData.access_token);
  const encrypted = await cifrarGmailToken(env, refreshToken);
  await env.DB.prepare(`
    INSERT INTO gmail_connections (
      user_id, google_email, refresh_token_ciphertext, refresh_token_iv,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      google_email = excluded.google_email,
      refresh_token_ciphertext = excluded.refresh_token_ciphertext,
      refresh_token_iv = excluded.refresh_token_iv,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    uid,
    String(profile.emailAddress || ""),
    encrypted.ciphertext,
    encrypted.iv
  ).run();

  return {
    email: String(profile.emailAddress || ""),
    totalMensagens: Number(profile.messagesTotal || 0),
    totalConversas: Number(profile.threadsTotal || 0)
  };
}

async function obterTokenGmail(env, uid) {
  const connection = await obterLigacaoGmail(env, uid);
  if (!connection) throw new HttpError(404, "Nenhuma conta Gmail está ligada.");

  const refreshToken = await decifrarGmailToken(env, connection);
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_GMAIL_CLIENT_ID,
      client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const tokenData = await response.json().catch(() => ({}));
  if (!response.ok || !tokenData.access_token) {
    if (tokenData.error === "invalid_grant") {
      await env.DB.prepare(`DELETE FROM gmail_connections WHERE user_id = ?`).bind(uid).run();
      throw new HttpError(401, "A autorização Gmail foi revogada. Liga novamente a conta.");
    }
    throw new HttpError(502, "Não foi possível renovar a autorização Gmail.");
  }
  return tokenData.access_token;
}

async function pedidoGmailWorker(caminho, accessToken) {
  const response = await fetch(`${GMAIL_API_URL}${caminho}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status === 401 ? 401 : 502, data?.error?.message || "O Gmail não respondeu.");
  }
  return data;
}

function gmailDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function reservarLeiturasGmail(env, uid, quantidade) {
  if (!quantidade) return 0;
  const dayKey = gmailDayKey();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO gmail_usage (user_id, day_key, messages_read)
    VALUES (?, ?, 0)
  `).bind(uid, dayKey).run();

  const reservation = await env.DB.prepare(`
    UPDATE gmail_usage
    SET messages_read = messages_read + ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND day_key = ? AND messages_read + ? <= ?
  `).bind(quantidade, uid, dayKey, quantidade, GMAIL_DAILY_LIMIT).run();

  if (Number(reservation.meta?.changes || 0) !== 1) {
    throw new HttpError(429, "Atingiste o limite diário de 100 emails nesta ferramenta.");
  }
  return quantidade;
}

function normalizarRemetenteGmail(valor = "") {
  const match = String(valor).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) return { nome: match[1].trim(), email: match[2].trim() };
  const email = String(valor).trim();
  return { nome: email.includes("@") ? email.split("@")[0] : email, email };
}

function normalizarMensagemGmail(message) {
  const headers = new Map((message.payload?.headers || []).map(item => [
    String(item.name || "").toLowerCase(),
    String(item.value || "")
  ]));
  const sender = normalizarRemetenteGmail(headers.get("from"));
  return {
    id: message.id,
    threadId: message.threadId,
    assunto: headers.get("subject") || "(Sem assunto)",
    remetente: sender.nome || sender.email || "Remetente desconhecido",
    emailRemetente: sender.email,
    data: Number(message.internalDate) || Date.parse(headers.get("date")) || Date.now(),
    excerto: String(message.snippet || "").trim(),
    naoLido: Array.isArray(message.labelIds) && message.labelIds.includes("UNREAD"),
    importante: Array.isArray(message.labelIds) && message.labelIds.includes("IMPORTANT"),
    link: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`
  };
}

function descodificarBase64UrlGmail(value) {
  if (!value) return "";
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return "";
  }
}

function limparHtmlGmail(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extrairCorpoGmail(partes = []) {
  let html = "";
  for (const part of partes) {
    const tipo = String(part.mimeType || "").toLowerCase();
    const decoded = descodificarBase64UrlGmail(part.body?.data);
    if (tipo === "text/plain" && decoded) return decoded;
    if (tipo === "text/html" && decoded && !html) html = limparHtmlGmail(decoded);
    if (Array.isArray(part.parts)) {
      const nested = extrairCorpoGmail(part.parts);
      if (nested) return nested;
    }
  }
  return html;
}

async function obterMensagemGmail(env, uid, messageId) {
  await reservarLeiturasGmail(env, uid, 1);
  const accessToken = await obterTokenGmail(env, uid);
  const message = await pedidoGmailWorker(
    `/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken
  );
  const resumo = normalizarMensagemGmail(message);
  const partes = message.payload?.parts || (message.payload ? [message.payload] : []);
  const corpo = extrairCorpoGmail(partes).slice(0, 200_000);
  return {
    ...resumo,
    corpo
  };
}

async function listarMensagensGmail(env, uid, url) {
  const limite = [10, 25, 50].includes(Number(url.searchParams.get("limite")))
    ? Number(url.searchParams.get("limite"))
    : 25;
  const filtro = ["todos", "nao_lidos", "anexos"].includes(url.searchParams.get("filtro"))
    ? url.searchParams.get("filtro")
    : "todos";
  const accessToken = await obterTokenGmail(env, uid);
  const params = new URLSearchParams({ maxResults: String(limite), labelIds: "INBOX" });
  if (filtro === "nao_lidos") params.set("q", "is:unread");
  if (filtro === "anexos") params.set("q", "has:attachment");

  const list = await pedidoGmailWorker(`/messages?${params}`, accessToken);
  const ids = Array.isArray(list.messages) ? list.messages.slice(0, limite) : [];
  await reservarLeiturasGmail(env, uid, ids.length);

  const messages = [];
  for (let index = 0; index < ids.length; index += 5) {
    const batch = ids.slice(index, index + 5);
    const results = await Promise.all(batch.map(({ id }) => {
      const headers = new URLSearchParams({ format: "metadata" });
      ["From", "Subject", "Date"].forEach(name => headers.append("metadataHeaders", name));
      return pedidoGmailWorker(`/messages/${encodeURIComponent(id)}?${headers}`, accessToken);
    }));
    messages.push(...results.map(normalizarMensagemGmail));
  }

  const usage = await env.DB.prepare(`
    SELECT messages_read FROM gmail_usage WHERE user_id = ? AND day_key = ?
  `).bind(uid, gmailDayKey()).first();
  return {
    messages,
    readCount: ids.length,
    remaining: Math.max(0, GMAIL_DAILY_LIMIT - Number(usage?.messages_read || 0))
  };
}

async function revogarLigacaoGmail(env, uid) {
  const connection = await obterLigacaoGmail(env, uid);
  if (!connection) return;
  try {
    const refreshToken = await decifrarGmailToken(env, connection);
    await fetch(GMAIL_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken })
    });
  } catch (error) {
    console.warn("[GMAIL] Não foi possível revogar a autorização Google", error);
  } finally {
    await env.DB.prepare(`DELETE FROM gmail_connections WHERE user_id = ?`).bind(uid).run();
  }
}

async function ensureUsage(env, uid) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO storage_usage (user_id)
    VALUES (?)
  `).bind(uid).run();
}

async function getUsage(env, uid) {
  await ensureUsage(env, uid);

  return env.DB.prepare(`
    SELECT used_bytes
    FROM storage_usage
    WHERE user_id = ?
  `).bind(uid).first();
}

function quotaForPlan(env, plan) {
  if (plan === "premium") {
    return Number(env.PREMIUM_QUOTA_BYTES || PREMIUM_DEFAULT_QUOTA_BYTES);
  }

  if (plan === "premium_plus") {
    return Number(env.PREMIUM_PLUS_QUOTA_BYTES || PREMIUM_PLUS_DEFAULT_QUOTA_BYTES);
  }

  return FREE_QUOTA_BYTES;
}

async function limiteCaixasPorPlano(env, plan) {
  try {
    const linha = await env.DB.prepare(`
      SELECT max_caixas_por_nota
      FROM plan_limits
      WHERE plan = ?
    `).bind(plan).first();

    const limite = Number(linha?.max_caixas_por_nota);
    if (Number.isInteger(limite) && limite > 0) return limite;
  } catch (erro) {
    console.warn('[BILLING] Não foi possível ler plan_limits; a usar o limite predefinido:', erro);
  }

  return LIMITE_CAIXAS_POR_PLANO[plan] || LIMITE_CAIXAS_POR_PLANO.free;
}

function aiPolicyForPlan(plan) {
  if (plan === "premium" || plan === "premium_plus") {
    return {
      dailyLimit: null,
      monthlyLimit: AI_MONTHLY_LIMITS[plan],
      paidLimit: AI_PAID_LIMITS[plan]
    };
  }

  return {
    dailyLimit: AI_FREE_DAILY_LIMIT,
    monthlyLimit: null,
    paidLimit: 0
  };
}

function aiPeriodKeys() {
  const now = new Date();
  return {
    dayKey: now.toISOString().slice(0, 10),
    monthKey: now.toISOString().slice(0, 7)
  };
}

async function reserveAiOperation(env, uid, plan) {
  const { dayKey, monthKey } = aiPeriodKeys();
  const policy = aiPolicyForPlan(plan);

  await env.DB.prepare(`
    INSERT OR IGNORE INTO ai_usage (user_id, day_key, month_key)
    VALUES (?, ?, ?)
  `).bind(uid, dayKey, monthKey).run();

  const current = await env.DB.prepare(`
    SELECT day_key, daily_count, month_key, month_count
    FROM ai_usage
    WHERE user_id = ?
  `).bind(uid).first();

  const dailyCount = current?.day_key === dayKey ? Number(current.daily_count || 0) : 0;
  const monthCount = current?.month_key === monthKey ? Number(current.month_count || 0) : 0;

  if (policy.dailyLimit !== null && dailyCount >= policy.dailyLimit) {
    throw new HttpError(429, "Atingiste o limite diário de IA do plano Free (10 operações). Volta amanhã.");
  }

  if (policy.monthlyLimit !== null && monthCount >= policy.monthlyLimit) {
    throw new HttpError(429, `Atingiste o limite mensal de IA do plano ${plan} (${policy.monthlyLimit} operações).`);
  }

  const nextDailyCount = current?.day_key === dayKey ? dailyCount + 1 : 1;
  const nextMonthCount = current?.month_key === monthKey ? monthCount + 1 : 1;

  await env.DB.prepare(`
    UPDATE ai_usage
    SET day_key = ?, daily_count = ?, month_key = ?, month_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(dayKey, nextDailyCount, monthKey, nextMonthCount, uid).run();

  const paid = plan !== "free" && monthCount < policy.paidLimit;

  return {
    plan,
    modelMode: paid ? "paid" : "free",
    dailyCount: nextDailyCount,
    monthCount: nextMonthCount,
    dailyLimit: policy.dailyLimit,
    monthlyLimit: policy.monthlyLimit,
    paidLimit: policy.paidLimit
  };
}

function aiUsageUserId(uid, entitlement) {
  return entitlement.previewPlan
    ? `preview:${uid}:${entitlement.previewPlan}`
    : uid;
}

async function openRouterChat(env, model, payload) {
  if (!env.OPENROUTER_API_KEY) {
    throw new HttpError(503, "A IA ainda não está configurada no Worker.");
  }

  const body = {
    model,
    messages: payload.messages,
    temperature: Number.isFinite(payload.temperature) ? payload.temperature : 0.4
  };

  if (payload.responseFormat && typeof payload.responseFormat === "object") {
    body.response_format = payload.responseFormat;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.APP_URL || "https://notabook.site",
      "X-Title": "NotaBook"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status === 429 ? 503 : 502, data?.error?.message || "A IA rejeitou o pedido.");
  }

  return data;
}

async function runAiOperation(env, payload, modelMode) {
  if (modelMode === "paid") {
    try {
      return {
        data: await openRouterChat(env, AI_PAID_MODEL, payload),
        model: AI_PAID_MODEL
      };
    } catch (error) {
      console.warn("Modelo pago indisponível; a tentar um modelo gratuito.", error);
    }
  }

  let lastError;
  for (const model of AI_FREE_MODELS) {
    try {
      return { data: await openRouterChat(env, model, payload), model };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new HttpError(503, "Não foi possível obter uma resposta da IA.");
}

async function getSubscription(env, uid) {
  return env.DB.prepare(`
    SELECT *
    FROM subscriptions
    WHERE user_id = ?
  `).bind(uid).first();
}

function getAdminPlanPreview(request, uid, env) {
  if (!request || !isAdmin(uid, env)) return null;

  const requested = request.headers.get("X-Admin-Plan-Preview");
  return normaliseFeaturePlan(requested);
}

async function getEntitlement(env, uid, request = null) {
  const subscription = await getSubscription(env, uid);
  const active = ["active", "trialing"].includes(subscription?.status);
  // O estatuto de administrador controla apenas a administração.
  // O plano continua a refletir a subscrição Stripe para permitir testar
  // Free, Premium e Premium Plus com a própria conta de administrador.
  const actualPlan = active ? subscription.plan : "free";
  const previewPlan = getAdminPlanPreview(request, uid, env);
  const plan = previewPlan || actualPlan;
  const maxCaixasPorNota = await limiteCaixasPorPlano(env, plan);

  return {
    plan,
    actualPlan,
    previewPlan,
    status: subscription?.status || "inactive",
    quotaBytes: quotaForPlan(env, plan),
    maxCaixasPorNota,
    currentPeriodEnd: subscription?.current_period_end || null,
    subscription
  };
}

function normaliseFeaturePlan(value) {
  return Object.prototype.hasOwnProperty.call(FEATURE_PLAN_RANK, value) ? value : null;
}

function isFeatureAllowed(feature, plan) {
  const minimum = normaliseFeaturePlan(feature.min_plan) || "free";
  return Number(feature.active) === 1 && FEATURE_PLAN_RANK[plan] >= FEATURE_PLAN_RANK[minimum];
}

async function getFeatureRows(env) {
  const panelStatements = USER_PANEL_FEATURES.map(([key, label, description]) => env.DB.prepare(`
      INSERT OR IGNORE INTO feature_access (
        feature_key, label, description, min_plan, active, updated_at
      ) VALUES (?, ?, ?, 'free', 1, CURRENT_TIMESTAMP)
    `).bind(key, label, description));
  const storeStatements = STORE_FEATURES.map(([key, label, description, plan]) => env.DB.prepare(`
      INSERT OR IGNORE INTO feature_access (
        feature_key, label, description, min_plan, active, updated_at
      ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(key, label, description, plan));
  await env.DB.batch([...panelStatements, ...storeStatements]);

  const result = await env.DB.prepare(`
    SELECT feature_key, label, description, min_plan, active, updated_at
    FROM feature_access
    ORDER BY label COLLATE NOCASE
  `).all();
  return result.results || [];
}

function isAdmin(uid, env) {
  const configured = String(env.ADMIN_UIDS || env.ADMIN_UID || "")
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean);
  return configured.includes(uid);
}

function assertAdmin(uid, env) {
  if (!isAdmin(uid, env)) {
    throw new HttpError(403, "Acesso reservado ao administrador.");
  }
}

function stripeMode(env) {
  return String(env.STRIPE_MODE || "test").toLowerCase() === "live" ? "live" : "test";
}

async function getBillingState(env) {
  let configured = false;
  let enabled = false;
  try {
    const row = await env.DB.prepare(`
      SELECT value
      FROM billing_settings
      WHERE setting_key = 'sales_enabled'
    `).first();
    configured = Boolean(row);
    enabled = row?.value === "1";
  } catch (_) {
    // Se a tabela ainda não foi criada, as vendas ficam fechadas por segurança.
  }

  const mode = stripeMode(env);
  const liveKeyReady = String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
  const readyForLive = mode === "live" && liveKeyReady;

  return {
    configured,
    stripeMode: mode,
    readyForLive,
    salesEnabled: enabled && readyForLive
  };
}

async function setBillingSalesEnabled(env, enabled) {
  await env.DB.prepare(`
    INSERT INTO billing_settings (setting_key, value, updated_at)
    VALUES ('sales_enabled', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(enabled ? "1" : "0").run();
}

function validateFeatureInput(body, { creating = false } = {}) {
  const key = String(body.key || body.featureKey || "").trim();
  const label = String(body.label || "").trim();
  const description = String(body.description || "").trim().slice(0, 180);
  const minPlan = normaliseFeaturePlan(body.minPlan || body.min_plan || "free");

  if (creating && !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(key)) {
    throw new HttpError(400, "A chave deve ter 2-64 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.");
  }
  if (!label || label.length > 80) {
    throw new HttpError(400, "O nome da ferramenta é obrigatório e deve ter até 80 caracteres.");
  }
  if (!minPlan) {
    throw new HttpError(400, "O plano mínimo indicado é inválido.");
  }

  return {
    key,
    label,
    description,
    minPlan,
    active: body.active === false || body.active === 0 ? 0 : 1
  };
}

function stripePriceForPlan(env, plan) {
  if (plan === "premium") return env.STRIPE_PRICE_PREMIUM;
  if (plan === "premium_plus") return env.STRIPE_PRICE_PREMIUM_PLUS;
  return null;
}

function planForStripePrice(env, priceId) {
  if (priceId && priceId === env.STRIPE_PRICE_PREMIUM) return "premium";
  if (priceId && priceId === env.STRIPE_PRICE_PREMIUM_PLUS) return "premium_plus";
  return null;
}

async function stripeRequest(env, path, params) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Stripe ainda não está configurada no Worker.");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();

  if (!response.ok) {
    throw new HttpError(
      502,
      data?.error?.message || "A Stripe rejeitou o pedido."
    );
  }

  return data;
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;

  const values = {};
  for (const item of signatureHeader.split(",")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    values[item.slice(0, separator).trim()] = item.slice(separator + 1).trim();
  }

  const timestamp = Number(values.t);
  const signature = values.v1;

  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedPayload = `${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  return constantTimeEqual(bytesToHex(digest), signature);
}

async function findUserIdBySubscription(env, stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;

  const row = await env.DB.prepare(`
    SELECT user_id
    FROM subscriptions
    WHERE stripe_subscription_id = ?
  `).bind(stripeSubscriptionId).first();

  return row?.user_id || null;
}

async function saveSubscription(env, values) {
  await env.DB.prepare(`
    INSERT INTO subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = excluded.plan,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    values.userId,
    values.customerId || null,
    values.subscriptionId || null,
    values.plan || "free",
    values.status || "inactive",
    values.currentPeriodEnd || null,
    values.cancelAtPeriodEnd ? 1 : 0
  ).run();
}

async function processStripeEvent(env, event) {
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const userId = object.client_reference_id || object.metadata?.firebase_uid;
    const plan = object.metadata?.plan || "free";

    if (userId && object.subscription) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId: object.subscription,
        plan,
        status: "active"
      });
    }
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscriptionId = object.id;
    const userId = object.metadata?.firebase_uid ||
      await findUserIdBySubscription(env, subscriptionId);
    const priceId = object.items?.data?.[0]?.price?.id;
    const detectedPlan = planForStripePrice(env, priceId) || object.metadata?.plan || "free";
    const active = ["active", "trialing"].includes(object.status);

    if (userId) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId,
        plan: active ? detectedPlan : "free",
        status: object.status || "inactive",
        currentPeriodEnd: object.current_period_end,
        cancelAtPeriodEnd: object.cancel_at_period_end
      });
    }
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const userId = object.metadata?.firebase_uid ||
      await findUserIdBySubscription(env, object.id);

    if (userId) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId: object.id,
        plan: "free",
        status: "canceled",
        currentPeriodEnd: object.current_period_end
      });
    }
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const userId = await findUserIdBySubscription(env, object.subscription);

    if (userId) {
      await env.DB.prepare(`
        UPDATE subscriptions
        SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(userId).run();
    }
  }
}

const NEWS_MARKETS = {
  PT: { setlang: "pt-PT", cc: "PT" },
  BR: { setlang: "pt-BR", cc: "BR" },
  US: { setlang: "en-US", cc: "US" },
  GB: { setlang: "en-GB", cc: "GB" },
  ES: { setlang: "es-ES", cc: "ES" }
};

function normaliseNewsTerms(value, limit) {
  return [...new Set(String(value || "")
    .split("|")
    .map(term => term.normalize("NFKC").replace(/["\\<>\u0000-\u001f]/g, "").trim().slice(0, 60))
    .filter(Boolean))]
    .slice(0, limit);
}

function buildNewsSearchConfig(url) {
  const topics = normaliseNewsTerms(url.searchParams.get("temas"), 8);
  const excluded = normaliseNewsTerms(url.searchParams.get("excluir"), 6);
  if (!topics.length) throw new HttpError(400, "Indica pelo menos um tema de notícias.");

  const marketKey = String(url.searchParams.get("mercado") || "PT").toUpperCase();
  const market = NEWS_MARKETS[marketKey] || NEWS_MARKETS.PT;
  const query = [
    topics.join(" OR "),
    ...excluded.map(term => `-${term}`)
  ].join(" ");
  return { topics, excluded, marketKey, market, query };
}

function buildBingNewsRssUrl(url) {
  const { market, query } = buildNewsSearchConfig(url);
  const feedUrl = new URL("https://www.bing.com/news/search");
  feedUrl.searchParams.set("q", query);
  feedUrl.searchParams.set("format", "rss");
  feedUrl.searchParams.set("setlang", market.setlang);
  feedUrl.searchParams.set("cc", market.cc);
  feedUrl.searchParams.set("count", "30");
  return feedUrl;
}

function buildGNewsUrl(config, apiKey) {
  const endpoint = new URL("https://gnews.io/api/v4/search");
  endpoint.searchParams.set("q", config.query);
  endpoint.searchParams.set("lang", "pt");
  endpoint.searchParams.set("country", config.market.cc.toLowerCase());
  endpoint.searchParams.set("max", "10");
  endpoint.searchParams.set("sortby", "publishedAt");
  endpoint.searchParams.set("apikey", apiKey);
  return endpoint;
}

function buildNewsApiUrl(config, apiKey) {
  const endpoint = new URL("https://newsapi.org/v2/everything");
  endpoint.searchParams.set("q", config.query);
  endpoint.searchParams.set("language", "pt");
  endpoint.searchParams.set("sortBy", "publishedAt");
  endpoint.searchParams.set("pageSize", "20");
  endpoint.searchParams.set("apiKey", apiKey);
  return endpoint;
}

function buildMediastackUrl(config, apiKey) {
  const endpoint = new URL("https://api.mediastack.com/v1/news");
  endpoint.searchParams.set("access_key", apiKey);
  endpoint.searchParams.set("keywords", config.query);
  endpoint.searchParams.set("languages", "pt");
  endpoint.searchParams.set("countries", config.market.cc.toLowerCase());
  endpoint.searchParams.set("sort", "published_desc");
  endpoint.searchParams.set("limit", "25");
  return endpoint;
}

function buildGdeltUrl(config) {
  const filtrosPorMercado = {
    PT: { idioma: "portuguese", pais: "portugal" },
    BR: { idioma: "portuguese", pais: "brazil" },
    US: { idioma: "english", pais: "unitedstates" },
    GB: { idioma: "english", pais: "unitedkingdom" },
    ES: { idioma: "spanish", pais: "spain" }
  };
  const filtro = filtrosPorMercado[config.marketKey] || filtrosPorMercado.PT;
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set(
    "query",
    `${config.query} sourcelang:${filtro.idioma} sourcecountry:${filtro.pais}`
  );
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("maxrecords", "25");
  endpoint.searchParams.set("timespan", "24h");
  endpoint.searchParams.set("sort", "datedesc");
  endpoint.searchParams.set("format", "rssarchive");
  return endpoint;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normaliseNewsDate(value) {
  const data = new Date(value || 0);
  return Number.isNaN(data.getTime()) ? new Date().toUTCString() : data.toUTCString();
}

function normaliseNewsArticles(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      titulo: String(item.title || item.name || "").trim(),
      link: String(item.url || item.link || "").trim(),
      fonte: String(item.source?.name || item.source?.title || item.source || "").trim(),
      publicadoEm: item.publishedAt || item.published_at || item.pubDate || "",
      imagem: String(item.image || item.urlToImage || item.image_url || "").trim()
    }))
    .filter(item => item.titulo && /^https?:\/\//i.test(item.link));
}

function newsArticlesToRss(articles, provider) {
  const items = articles.map(article => `
    <item>
      <title>${escapeXml(article.titulo)}</title>
      <link>${escapeXml(article.link)}</link>
      <guid isPermaLink="true">${escapeXml(article.link)}</guid>
      <source>${escapeXml(article.fonte || provider)}</source>
      <pubDate>${escapeXml(normaliseNewsDate(article.publicadoEm))}</pubDate>
      ${article.imagem ? `<enclosure url="${escapeXml(article.imagem)}" type="image/jpeg" />` : ""}
    </item>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NBX News</title>
    <description>Notícias reunidas pelo NotaBook através de ${escapeXml(provider)}.</description>
    <link>https://notabook.site</link>
    ${items}
  </channel>
</rss>`;
}

async function fetchJsonNewsProvider(provider, endpoint) {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    redirect: "follow"
  });
  const body = await response.text();
  let data = {};
  try {
    data = JSON.parse(body);
  } catch (_) {
    throw new Error(`${provider} devolveu uma resposta que não é JSON.`);
  }

  if (!response.ok) {
    throw new Error(`${provider} respondeu com HTTP ${response.status}.`);
  }

  if (data.status && data.status !== "ok") {
    throw new Error(`${provider}: ${data.message || data.status}`);
  }

  const articles = normaliseNewsArticles(data.articles || data.data || data.results);
  if (!articles.length) throw new Error(`${provider} não devolveu artigos.`);
  return newsArticlesToRss(articles, provider);
}

async function fetchGdeltNewsProvider(endpoint) {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.5" },
    redirect: "follow"
  });
  const xml = await response.text();
  if (!response.ok || !/<rss(?:\s|>)/i.test(xml)) {
    throw new Error(`GDELT respondeu com um feed RSS inválido (HTTP ${response.status}).`);
  }
  return xml;
}

function rss(request, xml) {
  const headers = headersFor(request, { "Content-Type": "application/rss+xml; charset=utf-8" });
  headers.set("Cache-Control", "private, max-age=300");
  return new Response(xml, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: headersFor(request)
        });
      }

      const url = new URL(request.url);

      if (url.pathname === "/favicon.ico" && request.method === "GET") {
        return new Response(null, {
          status: 204,
          headers: headersFor(request, { "Content-Type": "image/x-icon" })
        });
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return json(request, {
          ok: true,
          worker: "notabook-storage"
        });
      }

      if (url.pathname === "/billing/webhook" && request.method === "POST") {
        const payload = await request.text();
        const signature = request.headers.get("Stripe-Signature");
        const valid = await verifyStripeSignature(
          payload,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );

        if (!valid) {
          throw new HttpError(400, "Assinatura do webhook Stripe inválida.");
        }

        const event = JSON.parse(payload);
        const alreadyProcessed = await env.DB.prepare(`
          SELECT event_id
          FROM billing_events
          WHERE event_id = ?
        `).bind(event.id).first();

        if (!alreadyProcessed) {
          await processStripeEvent(env, event);
          await env.DB.prepare(`
            INSERT OR IGNORE INTO billing_events (event_id)
            VALUES (?)
          `).bind(event.id).run();
        }

        return json(request, { received: true });
      }

      const siteId = url.pathname.match(/^\/sites\/([A-Za-z0-9_-]{1,128})$/)?.[1];
      if (siteId && request.method === "GET") {
        await assertPublicSiteRateLimit(env, request, "site");
        return json(request, await obterSiteAutorizado(env, siteId));
      }

      const siteCoverId = url.pathname.match(/^\/sites\/([A-Za-z0-9_-]{1,128})\/cover$/)?.[1];
      if (siteCoverId && request.method === "GET") {
        await assertPublicSiteRateLimit(env, request, "cover");
        return await obterCapaSitePublica(env, request, siteCoverId);
      }

      const uid = await authenticate(request, env);

      const reminderResponse = await handleReminderRequest({
        request,
        env,
        uid,
        url,
        json,
        getEntitlement,
        isFeatureAllowed,
        readNote: (noteId) => lerDocumentoFirestore(env, 'Local', noteId)
      });
      if (reminderResponse) return reminderResponse;

      if (url.pathname.startsWith("/gmail/")) {
        await ensureGmailTables(env);
        await assertGmailFeature(env, uid, request);
      }

      if (url.pathname === "/gmail/oauth/exchange" && request.method === "POST") {
        if (request.headers.get("X-Requested-With") !== "XMLHttpRequest") {
          throw new HttpError(400, "Pedido de autorização Gmail inválido.");
        }
        const body = await request.json().catch(() => ({}));
        const code = String(body.code || "").trim();
        if (!code || code.length > 4096) {
          throw new HttpError(400, "Código de autorização Gmail inválido.");
        }
        const profile = await trocarCodigoGmail(env, request, uid, code);
        return json(request, { connected: true, profile });
      }

      if (url.pathname === "/gmail/connection" && request.method === "GET") {
        const connection = await obterLigacaoGmail(env, uid);
        return json(request, {
          connected: Boolean(connection),
          profile: connection ? { email: connection.google_email } : null
        });
      }

      if (url.pathname === "/gmail/connection" && request.method === "DELETE") {
        await revogarLigacaoGmail(env, uid);
        return json(request, { ok: true, connected: false });
      }

      if (url.pathname === "/gmail/messages" && request.method === "GET") {
        return json(request, await listarMensagensGmail(env, uid, url));
      }

      const gmailMessageId = url.pathname.match(/^\/gmail\/messages\/([^/]+)$/)?.[1];
      if (gmailMessageId && request.method === "GET") {
        return json(request, {
          message: await obterMensagemGmail(env, uid, decodeURIComponent(gmailMessageId))
        });
      }

      if (url.pathname === "/news/rss" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const features = await getFeatureRows(env);
        const feature = features.find(item => item.feature_key === "ferramenta_noticias");
        if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
          throw new HttpError(403, "A ferramenta Notícias não está disponível no teu plano.");
        }

        const config = buildNewsSearchConfig(url);
        const providers = [];

        if (env.GNEWS_API_KEY) {
          providers.push({
            nome: "GNews",
            executar: () => fetchJsonNewsProvider(
              "GNews",
              buildGNewsUrl(config, env.GNEWS_API_KEY)
            )
          });
        }
        if (env.NEWSAPI_API_KEY) {
          providers.push({
            nome: "NewsAPI",
            executar: () => fetchJsonNewsProvider(
              "NewsAPI",
              buildNewsApiUrl(config, env.NEWSAPI_API_KEY)
            )
          });
        }
        if (env.MEDIASTACK_API_KEY) {
          providers.push({
            nome: "Mediastack",
            executar: () => fetchJsonNewsProvider(
              "Mediastack",
              buildMediastackUrl(config, env.MEDIASTACK_API_KEY)
            )
          });
        }

        providers.push({
          nome: "GDELT",
          executar: () => fetchGdeltNewsProvider(buildGdeltUrl(config))
        });

        for (const provider of providers) {
          try {
            console.log("NBX News: a consultar fornecedor", {
              fornecedor: provider.nome,
              query: config.query
            });
            const xml = await provider.executar();
            console.log("NBX News: fornecedor concluído", {
              fornecedor: provider.nome,
              tamanho: xml.length
            });
            return rss(request, xml);
          } catch (erro) {
            console.warn("NBX News: fornecedor indisponível", {
              fornecedor: provider.nome,
              mensagem: erro instanceof Error ? erro.message : String(erro)
            });
          }
        }

        throw new HttpError(
          502,
          "O NBX News não conseguiu obter notícias neste momento."
        );
      }

      if (url.pathname === "/features" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const features = await getFeatureRows(env);
        return json(request, {
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          isAdmin: isAdmin(uid, env),
          features: features
            .filter(feature => Number(feature.active) === 1)
            .map(feature => ({
              ...feature,
              allowed: isFeatureAllowed(feature, entitlement.plan)
            }))
        });
      }

      if (url.pathname === "/admin/features" && request.method === "GET") {
        assertAdmin(uid, env);
        return json(request, { features: await getFeatureRows(env) });
      }

      if (url.pathname === "/admin/features" && request.method === "POST") {
        assertAdmin(uid, env);
        const body = await request.json().catch(() => ({}));
        const feature = validateFeatureInput(body, { creating: true });
        const existing = await env.DB.prepare(`
          SELECT feature_key FROM feature_access WHERE feature_key = ?
        `).bind(feature.key).first();

        if (existing) throw new HttpError(409, "Já existe uma ferramenta com essa chave.");

        await env.DB.prepare(`
          INSERT INTO feature_access (feature_key, label, description, min_plan, active, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          feature.key, feature.label, feature.description, feature.minPlan, feature.active
        ).run();

        return json(request, { ok: true, feature: feature }, 201);
      }

      const adminFeatureKey = url.pathname.match(/^\/admin\/features\/([^/]+)$/)?.[1];
      if (adminFeatureKey && ["PUT", "DELETE"].includes(request.method)) {
        assertAdmin(uid, env);
        const key = decodeURIComponent(adminFeatureKey);
        const existing = await env.DB.prepare(`
          SELECT feature_key FROM feature_access WHERE feature_key = ?
        `).bind(key).first();
        if (!existing) throw new HttpError(404, "Ferramenta não encontrada.");

        if (request.method === "DELETE") {
          if (PROTECTED_FEATURE_KEYS.has(key)) {
            throw new HttpError(409, "Esta funcionalidade estrutural não pode ser removida; desativa-a ou altera o plano mínimo.");
          }
          await env.DB.prepare(`DELETE FROM feature_access WHERE feature_key = ?`).bind(key).run();
          return json(request, { ok: true, deleted: key });
        }

        const body = await request.json().catch(() => ({}));
        const feature = validateFeatureInput(body);
        await env.DB.prepare(`
          UPDATE feature_access
          SET label = ?, description = ?, min_plan = ?, active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = ?
        `).bind(
          feature.label, feature.description, feature.minPlan, feature.active, key
        ).run();

        return json(request, { ok: true, feature: { ...feature, key } });
      }

      if (url.pathname === "/admin/billing" && request.method === "GET") {
        assertAdmin(uid, env);
        return json(request, { ok: true, ...(await getBillingState(env)) });
      }

      if (url.pathname === "/admin/billing" && request.method === "PUT") {
        assertAdmin(uid, env);
        const body = await request.json().catch(() => ({}));
        const enabled = body.salesEnabled === true;
        const state = await getBillingState(env);

        if (enabled && !state.readyForLive) {
          throw new HttpError(
            409,
            "Configure primeiro o Worker com STRIPE_MODE=live e uma STRIPE_SECRET_KEY sk_live_."
          );
        }

        await setBillingSalesEnabled(env, enabled);
        const updatedState = await getBillingState(env);
        return json(request, { ok: true, ...updatedState });
      }

      if (url.pathname === "/billing/create-checkout-session" && request.method === "POST") {
        const billing = await getBillingState(env);
        if (!billing.salesEnabled) {
          throw new HttpError(403, "As compras ainda não foram abertas pelo administrador.");
        }

        const body = await request.json().catch(() => ({}));
        const plan = body.plan;
        const priceId = stripePriceForPlan(env, plan);

        if (!priceId) {
          throw new HttpError(400, "Plano inválido.");
        }

        const current = await getSubscription(env, uid);
        if (["active", "trialing"].includes(current?.status)) {
          throw new HttpError(409, "Já existe uma subscrição ativa.");
        }

        const appUrl = env.APP_URL || "https://notabook.site";
        const params = new URLSearchParams();
        params.set("mode", "subscription");
        params.set("line_items[0][price]", priceId);
        params.set("line_items[0][quantity]", "1");
        params.set("client_reference_id", uid);
        params.set("metadata[firebase_uid]", uid);
        params.set("metadata[plan]", plan);
        params.set("subscription_data[metadata][firebase_uid]", uid);
        params.set("subscription_data[metadata][plan]", plan);
        params.set("success_url", `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
        params.set("cancel_url", `${appUrl}/?billing=cancelled`);

        if (current?.stripe_customer_id) {
          params.set("customer", current.stripe_customer_id);
        }

        const session = await stripeRequest(env, "checkout/sessions", params);

        return json(request, {
          ok: true,
          url: session.url,
          sessionId: session.id
        });
      }

      if (url.pathname === "/billing/plan" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);

        return json(request, {
          ok: true,
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          isAdmin: isAdmin(uid, env),
          salesEnabled: (await getBillingState(env)).salesEnabled,
          status: entitlement.status,
          quotaBytes: entitlement.quotaBytes,
          maxCaixasPorNota: entitlement.maxCaixasPorNota,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(entitlement.subscription?.cancel_at_period_end)
        });
      }

      if (url.pathname === "/billing/cancel" && request.method === "POST") {
        const current = await getSubscription(env, uid);
        if (!current?.stripe_subscription_id || !["active", "trialing"].includes(current.status)) {
          throw new HttpError(409, "Não existe uma subscrição paga ativa para cancelar.");
        }

        if (Number(current.cancel_at_period_end) === 1) {
          return json(request, { ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: current.current_period_end });
        }

        const subscription = await stripeRequest(
          env,
          `subscriptions/${encodeURIComponent(current.stripe_subscription_id)}`,
          new URLSearchParams({ cancel_at_period_end: "true" })
        );

        await saveSubscription(env, {
          userId: uid,
          customerId: subscription.customer || current.stripe_customer_id,
          subscriptionId: subscription.id || current.stripe_subscription_id,
          plan: current.plan,
          status: subscription.status || current.status,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });

        return json(request, {
          ok: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end
        });
      }

      if (url.pathname === "/billing/resume" && request.method === "POST") {
        const current = await getSubscription(env, uid);
        if (!current?.stripe_subscription_id || !["active", "trialing"].includes(current.status)) {
          throw new HttpError(409, "Não existe uma subscrição paga ativa para retomar.");
        }

        const subscription = await stripeRequest(
          env,
          `subscriptions/${encodeURIComponent(current.stripe_subscription_id)}`,
          new URLSearchParams({ cancel_at_period_end: "false" })
        );

        await saveSubscription(env, {
          userId: uid,
          customerId: subscription.customer || current.stripe_customer_id,
          subscriptionId: subscription.id || current.stripe_subscription_id,
          plan: current.plan,
          status: subscription.status || current.status,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });

        return json(request, {
          ok: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end
        });
      }

      if (url.pathname === "/usage" && request.method === "GET") {
        const usage = await getUsage(env, uid);
        const usedBytes = Number(usage?.used_bytes || 0);
        const entitlement = await getEntitlement(env, uid, request);

        return json(request, {
          usedBytes,
          quotaBytes: entitlement.quotaBytes,
          remainingBytes: Math.max(0, entitlement.quotaBytes - usedBytes),
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan)
        });
      }

      if (url.pathname === "/ai/chat" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));

        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          throw new HttpError(400, "A operação de IA não contém mensagens.");
        }

        const entitlement = await getEntitlement(env, uid, request);
        const usage = await reserveAiOperation(
          env,
          aiUsageUserId(uid, entitlement),
          entitlement.plan
        );
        const result = await runAiOperation(env, body, usage.modelMode);

        return json(request, {
          ...result.data,
          ai: {
            task: body.task || "general",
            plan: usage.plan,
            model: result.model,
            modelMode: usage.modelMode,
            dailyCount: usage.dailyCount,
            dailyLimit: usage.dailyLimit,
            monthCount: usage.monthCount,
            monthlyLimit: usage.monthlyLimit,
            paidLimit: usage.paidLimit
          }
        });
      }

      if (url.pathname === "/ai/usage" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const { dayKey, monthKey } = aiPeriodKeys();
        const row = await env.DB.prepare(`
          SELECT day_key, daily_count, month_key, month_count
          FROM ai_usage
          WHERE user_id = ?
        `).bind(aiUsageUserId(uid, entitlement)).first();
        const policy = aiPolicyForPlan(entitlement.plan);

        return json(request, {
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          dailyCount: row?.day_key === dayKey ? Number(row.daily_count || 0) : 0,
          dailyLimit: policy.dailyLimit,
          monthCount: row?.month_key === monthKey ? Number(row.month_count || 0) : 0,
          monthlyLimit: policy.monthlyLimit,
          paidLimit: policy.paidLimit
        });
      }

      if (url.pathname === "/files" && request.method === "GET") {
        const noteId = url.searchParams.get("noteId");
        const contextType = url.searchParams.get("contextType");
        const contextId = url.searchParams.get("contextId");
        let result;

        const columns = `
          SELECT id, file_name, content_type, size_bytes, created_at,
                 note_id, context_type, context_id
          FROM files
        `;

        if (noteId && contextType && contextId) {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ? AND note_id = ? AND context_type = ? AND context_id = ?
            ORDER BY created_at DESC
          `).bind(uid, noteId, contextType, contextId).all();
        } else if (noteId) {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ? AND note_id = ?
            ORDER BY created_at DESC
          `).bind(uid, noteId).all();
        } else {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ?
            ORDER BY created_at DESC
          `).bind(uid).all();
        }

        return json(request, { files: result.results });
      }

      if (url.pathname === "/files" && request.method === "PUT") {
        const noteId = url.searchParams.get("noteId");
        const contextType = url.searchParams.get("contextType");
        const contextId = url.searchParams.get("contextId");

        if (!noteId || !contextType || !contextId) {
          throw new HttpError(400, "É obrigatório indicar a nota e o contexto do ficheiro.");
        }

        if (!["caixa", "tarefa", "site"].includes(contextType)) {
          throw new HttpError(400, "O contexto deve ser caixa ou tarefa.");
        }

        if (contextType === "site" && contextId !== noteId) {
          throw new HttpError(400, "O contexto da capa não corresponde à nota.");
        }

        const size = Number(request.headers.get("Content-Length"));
        if (!Number.isSafeInteger(size) || size <= 0) {
          throw new HttpError(411, "O tamanho do ficheiro não foi indicado.");
        }

        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        if (contextType === "site" && !contentType.toLowerCase().startsWith("image/")) {
          throw new HttpError(415, "A capa tem de ser uma imagem.");
        }
        if (contextType === "site" && size > SITE_COVER_MAX_BYTES) {
          throw new HttpError(413, "A imagem de capa não pode ultrapassar 10 MB.");
        }

        const entitlement = await getEntitlement(env, uid, request);
        if (contextType === "site") {
          const feature = await env.DB.prepare(`
            SELECT feature_key, min_plan, active
            FROM feature_access
            WHERE feature_key = ?
          `).bind("sites_publicos").first();
          if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
            throw new HttpError(403, "A publicação de Sites não está disponível no plano actual.");
          }
        }
        const usage = await getUsage(env, uid);
        const currentUsage = Number(usage?.used_bytes || 0);

        if (currentUsage + size > entitlement.quotaBytes) {
          throw new HttpError(413, `Atingiste o limite do plano ${entitlement.plan}.`);
        }

        const fileId = crypto.randomUUID();
        const fileName = cleanFileName(url.searchParams.get("name"));
        const objectKey = `users/${uid}/files/${fileId}-${fileName}`;

        const reservation = await env.DB.prepare(`
          UPDATE storage_usage
          SET used_bytes = used_bytes + ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND used_bytes + ? <= ?
        `).bind(size, uid, size, entitlement.quotaBytes).run();

        if (Number(reservation.meta?.changes || 0) !== 1) {
          throw new HttpError(413, "O limite de armazenamento foi atingido.");
        }

        try {
          await env.FILES.put(objectKey, request.body, {
            httpMetadata: { contentType }
          });

          await env.DB.prepare(`
            INSERT INTO files (
              id, user_id, object_key, file_name, content_type, size_bytes,
              note_id, context_type, context_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            fileId, uid, objectKey, fileName, contentType, size,
            noteId, contextType, contextId
          ).run();

          const newUsage = await getUsage(env, uid);

          return json(request, {
            ok: true,
            id: fileId,
            name: fileName,
            sizeBytes: size,
            noteId,
            contextType,
            contextId,
            usedBytes: Number(newUsage?.used_bytes || 0),
            quotaBytes: entitlement.quotaBytes,
            plan: entitlement.plan
          }, 201);
        } catch (error) {
          await env.FILES.delete(objectKey);
          await env.DB.prepare(`
            UPDATE storage_usage
            SET used_bytes = MAX(0, used_bytes - ?), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(size, uid).run();
          throw error;
        }
      }

      const fileId = url.pathname.match(/^\/files\/([^/]+)$/)?.[1];

      if (fileId && request.method === "GET") {
        const file = await env.DB.prepare(`
          SELECT * FROM files WHERE id = ? AND user_id = ?
        `).bind(fileId, uid).first();

        if (!file) throw new HttpError(404, "Ficheiro não encontrado.");

        const object = await env.FILES.get(file.object_key);
        if (!object) throw new HttpError(404, "Objecto não encontrado no R2.");

        const headers = headersFor(request, {
          "Content-Type": file.content_type,
          "Content-Length": String(file.size_bytes),
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`
        });

        return new Response(object.body, { headers });
      }

      if (fileId && request.method === "DELETE") {
        const file = await env.DB.prepare(`
          SELECT * FROM files WHERE id = ? AND user_id = ?
        `).bind(fileId, uid).first();

        if (!file) throw new HttpError(404, "Ficheiro não encontrado.");

        await env.FILES.delete(file.object_key);

        await env.DB.batch([
          env.DB.prepare(`DELETE FROM files WHERE id = ? AND user_id = ?`).bind(fileId, uid),
          env.DB.prepare(`
            UPDATE storage_usage
            SET used_bytes = MAX(0, used_bytes - ?), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(file.size_bytes, uid)
        ]);

        return json(request, { ok: true, deleted: fileId });
      }

      return json(request, { error: "Rota não encontrada." }, 404);
    } catch (error) {
      console.error(error);
      return json(
        request,
        { error: error.message || "Erro interno." },
        error.status || 500,
        error.headers || {}
      );
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processDueReminders({ env, getEntitlement, isFeatureAllowed }));
  }
};
