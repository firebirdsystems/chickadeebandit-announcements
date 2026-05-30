SELECT
  id,
  title,
  body,
  author_name,
  expires_at,
  approved_at,
  created_at
FROM announcements
WHERE household_id = current_setting('app.household_id', true)::uuid
  AND status       = 'approved'
  AND expires_at   > NOW()::text
ORDER BY created_at DESC
LIMIT 50
