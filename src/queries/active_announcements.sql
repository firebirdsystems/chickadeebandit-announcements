SELECT
  a.id,
  a.title,
  a.body,
  a.author_name,
  a.expires_at,
  apr.approved_at,
  a.created_at
FROM app_announcements__announcements a
JOIN app_announcements__approvals apr ON apr.announcement_id = a.id
WHERE a.expires_at > datetime('now')
ORDER BY a.created_at DESC
LIMIT 50
