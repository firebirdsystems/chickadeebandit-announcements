CREATE TABLE IF NOT EXISTS app_announcements__approvals (
  announcement_id TEXT NOT NULL PRIMARY KEY,
  approved_by     TEXT NOT NULL,
  approved_at     TEXT NOT NULL
);

-- Migrate existing approved/archived announcements into the new approvals table
-- so their approval state is owned by the privileged child table going forward.
INSERT OR IGNORE INTO app_announcements__approvals (announcement_id, approved_by, approved_at)
SELECT
  id,
  COALESCE(approved_by, 'system'),
  COALESCE(approved_at, updated_at, created_at)
FROM app_announcements__announcements
WHERE status IN ('approved', 'archived');
