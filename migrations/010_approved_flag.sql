-- Whether a moderator has approved the announcement, as a column the app can
-- never write.
--
-- Approval lives in the approvals table, which only the moderators group can
-- insert into. The stored `status` column is the author's own and is not
-- evidence of approval: an author can write 'approved' there by raw SQL, and a
-- moderator's approval never touches it. The page derives the real state with
-- a join, but the share link (`shareable.visible_where`) and the glance read
-- one column of this row. They read this one. It is closed to every app write
-- (`column_write_acls`) and set only by the hub's write effect when an
-- approval row is inserted, so it is 'approved' exactly when an approval
-- exists.
ALTER TABLE app_announcements__announcements ADD COLUMN approved_flag TEXT NOT NULL DEFAULT 'no';

UPDATE app_announcements__announcements
SET approved_flag = 'yes'
WHERE id IN (SELECT announcement_id FROM app_announcements__approvals);
