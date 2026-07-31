-- Retention index (see manifest.row_policies.announcements.retain_days).
--
-- Announcements accumulate forever: an expired notice keeps its row, and every
-- acknowledgement and approval attached to it keeps theirs. A household that
-- posts a couple of notices a week carries every one of them, and every
-- member's acknowledgement of every one, for the life of the account.
--
-- The hub requires an index whose FIRST column is the retention timestamp; the
-- only index this app had leads with `status`, so a sweep on `created_at` would
-- full-scan. `created_at` (not `expires_at`) is the axis: expiry is a display
-- rule the app already honours, while retention is about how long the record
-- itself is kept, and an announcement with no meaningful expiry should still
-- age out on the same clock as the rest.
CREATE INDEX IF NOT EXISTS idx_announcements_created
  ON app_announcements__announcements (created_at);
