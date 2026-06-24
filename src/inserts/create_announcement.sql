INSERT INTO app_announcements__announcements (
  id,
  title,
  body,
  status,
  author_id,
  author_name,
  expires_at,
  created_at,
  updated_at
) VALUES (
  lower(hex(randomblob(16))),
  $1,
  $2,
  'pending',
  'ai',
  'AI',
  $3,
  datetime('now'),
  datetime('now')
)
