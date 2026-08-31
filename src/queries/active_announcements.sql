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
-- `expires_at` is a bare "YYYY-MM-DD" (it comes off `<input type="date">`), so
-- it must be compared to a bare date. `datetime('now')` renders
-- 'YYYY-MM-DD HH:MM:SS', and the comparison is lexical: "2026-08-30" sorts
-- BEFORE "2026-08-30 14:22:00", so `> datetime('now')` dropped every
-- announcement on its own expiry day. `:today` is the household-LOCAL calendar
-- date (bound by the hub, never UTC), and `>=` keeps expiry day INCLUSIVE.
WHERE a.expires_at >= :today
ORDER BY a.created_at DESC
LIMIT 50
