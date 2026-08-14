CREATE TABLE IF NOT EXISTS billing_settings (
  setting_key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '0',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO billing_settings (setting_key, value)
VALUES ('sales_enabled', '0');
