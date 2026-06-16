SELECT
  id,
  title,
  body,
  author_name,
  created_at
FROM app_announcements__announcements
WHERE status       = 'pending'
ORDER BY created_at DESC
LIMIT 50
