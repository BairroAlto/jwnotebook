export const REMINDER_FEATURE_KEY = 'ferramenta_agenda_nota';

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

export async function handleReminderRequest({
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

export async function processDueReminders({ env, getEntitlement, isFeatureAllowed }) {
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
