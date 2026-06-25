SELECT
  a.id,
  a.title,
  a.body,
  a.author_name,
  a.created_at
FROM app_announcements__announcements a
LEFT JOIN app_announcements__approvals apr ON apr.announcement_id = a.id
WHERE apr.announcement_id IS NULL
  AND a.expires_at > datetime('now')
ORDER BY a.created_at DESC
LIMIT 50
