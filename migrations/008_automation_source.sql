-- Another app's event can post an announcement
-- (manifest.automation_actions.post / post_for_approval).
--
-- `source_event_id` does double duty. The dispatcher's dedupe guard reads it
-- before running an action (SELECT 1 ... WHERE source_event_id = ? LIMIT 1), so
-- one storm activation can't post the same notice twice. It is also how the
-- auto-approving recipe finds the row it just inserted: step values are
-- evaluated per expression, so `$uuid` cannot be referenced by a later step,
-- but `$event_id` is stable across the whole action — the lookup matches on it
-- to bind the new announcement's id for the approvals insert.
--
-- Nullable on purpose: announcements written by a member leave it NULL.
ALTER TABLE app_announcements__announcements ADD COLUMN source_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_source_event_id
  ON app_announcements__announcements (source_event_id);
