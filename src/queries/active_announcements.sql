SELECT
  id,
  title,
  body,
  author_name,
  expires_at,
  approved_at,
  created_at
FROM app_announcements__announcements
WHERE status       = 'approved'
  AND expires_at   > datetime('now')
ORDER BY created_at DESC
LIMIT 50
