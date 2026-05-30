UPDATE announcements
SET
  expires_at = $2,
  updated_at = NOW()::text
WHERE id           = $1
  AND household_id = current_setting('app.household_id', true)::uuid
  AND status       = 'approved'
