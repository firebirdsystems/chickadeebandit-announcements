INSERT INTO announcements (
  id,
  household_id,
  title,
  body,
  status,
  author_id,
  author_name,
  expires_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid()::text,
  current_setting('app.household_id', true)::uuid,
  $1,
  $2,
  'pending',
  'ai',
  'AI',
  $3,
  NOW()::text,
  NOW()::text
)
