UPDATE app_announcements__announcements
SET
  expires_at = $2,
  updated_at = datetime('now')
WHERE id = $1
  -- Approved by a moderator: the flag only an approval row sets, never the
  -- author's own status column, which a moderator's approval leaves alone.
  AND approved_flag = 'yes'
