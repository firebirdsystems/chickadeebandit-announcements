-- Whether this announcement should also go out by email when it is approved.
-- Recorded at compose time so a non-moderator can request it and the approving
-- moderator honors that choice, rather than the decision being re-litigated in
-- the approve click where there is no room to ask.
ALTER TABLE app_announcements__announcements ADD COLUMN email_everyone INTEGER NOT NULL DEFAULT 0;
