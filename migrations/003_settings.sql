CREATE TABLE IF NOT EXISTS app_announcements__settings (
  key   TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (key)
);
