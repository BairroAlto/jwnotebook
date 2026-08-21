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
