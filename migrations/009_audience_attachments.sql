-- Who an announcement is delivered to, and what is attached to it.
--
-- `audience_kind` decides who the push (and the optional email) goes to when
-- the announcement is approved: everyone the app admits, one hub member group,
-- or a chosen list of members. It is a delivery choice, not a read
-- restriction: an approved announcement stays readable by every member in
-- the app, as before. Recorded at compose time, like email_everyone, so a
-- non-moderator's choice is honoured by whoever approves it.
ALTER TABLE app_announcements__announcements ADD COLUMN audience_kind TEXT NOT NULL DEFAULT 'everyone';

ALTER TABLE app_announcements__announcements ADD COLUMN audience_group_id TEXT;

-- JSON array of member ids; used when audience_kind is 'members'.
ALTER TABLE app_announcements__announcements ADD COLUMN audience_member_ids TEXT NOT NULL DEFAULT '[]';

-- One attached file (a PDF, an image) per row. A child table rather than a
-- JSON list on the announcement because retention reclaims a dependent
-- table's scalar file column when the announcement ages out, and nothing
-- reclaims a list column on that path. Inherits the announcement's
-- visibility. Only the announcement's author adds one; a moderator may
-- remove one; nobody moves one to another announcement or swaps its file.
CREATE TABLE IF NOT EXISTS app_announcements__attachments (
  id              TEXT NOT NULL PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  file_id         TEXT NOT NULL,
  file_name       TEXT NOT NULL DEFAULT '',
  uploaded_by     TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- An announcement's attachments, in the order they were added.
CREATE INDEX IF NOT EXISTS idx_attachments_announcement
  ON app_announcements__attachments (announcement_id, created_at);
