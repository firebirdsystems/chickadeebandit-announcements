-- Shipped with no indexes. `approvals` needs none (announcement_id is its PK)
-- and `acknowledgements` already covers announcement_id via the leftmost prefix
-- of PRIMARY KEY (announcement_id, member_id) — but not the per-member lookup,
-- which runs on every app open.

-- loadAcknowledgements: WHERE member_id = ?
CREATE INDEX IF NOT EXISTS idx_acks_member
  ON app_announcements__acknowledgements (member_id);

-- Active/pending listing: filtered on status and the expiry window.
-- Both columns are plaintext (`status` is in the platform skip-list,
-- `expires_at` by the _at suffix rule), so this index is usable.
CREATE INDEX IF NOT EXISTS idx_announcements_status_expires
  ON app_announcements__announcements (status, expires_at);
