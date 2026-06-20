ALTER TABLE app_announcements__announcements ADD COLUMN is_critical INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS app_announcements__acknowledgements (
  announcement_id TEXT NOT NULL,
  member_id       TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (announcement_id, member_id)
);
