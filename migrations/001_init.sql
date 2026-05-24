CREATE TABLE IF NOT EXISTS announcements (
  household_id UUID    NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',
  author_id    TEXT    NOT NULL,
  author_name  TEXT    NOT NULL,
  expires_at   TEXT    NOT NULL,
  approved_by  TEXT,
  approved_at  TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  PRIMARY KEY (household_id, id)
);
