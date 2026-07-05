UPDATE app_announcements__announcements
SET
  expires_at = $2,
  updated_at = datetime('now')
WHERE id = $1
  AND status IN ('approved', 'archived')
