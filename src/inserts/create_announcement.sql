INSERT INTO app_announcements__announcements (
  id,
  title,
  body,
  status,
  author_name,
  expires_at,
  author_id,
  created_at,
  updated_at
) VALUES (
  lower(hex(randomblob(16))),
  $1,
  $2,
  'pending',
  'AI',
  $3,
  $4,
  datetime('now'),
  datetime('now')
)
