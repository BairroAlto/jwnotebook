CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
ON push_subscriptions(user_id, enabled, updated_at);

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
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user
ON push_devices(user_id, enabled, last_seen_at);

INSERT OR IGNORE INTO push_devices (
  id, user_id, client_id, token, device_label, enabled,
  created_at, last_seen_at, updated_at
)
SELECT id, user_id, id, token, device_label, 0,
       created_at, updated_at, updated_at
FROM push_subscriptions;

DELETE FROM push_subscriptions;

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
);

CREATE INDEX IF NOT EXISTS idx_note_reminders_due
ON note_reminders(status, remind_at, next_attempt_at);

INSERT OR IGNORE INTO feature_access (
  feature_key, label, description, min_plan, active
) VALUES (
  'ferramenta_agenda_nota',
  'Agenda da Nota',
  'Lembretes para regressar a uma nota através de notificações da aplicação.',
  'premium',
  1
);
