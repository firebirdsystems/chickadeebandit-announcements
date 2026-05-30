SELECT
  id,
  title,
  body,
  author_name,
  created_at
FROM announcements
WHERE household_id = current_setting('app.household_id', true)::uuid
  AND status       = 'pending'
ORDER BY created_at DESC
LIMIT 50
