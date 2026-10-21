# Announcements

A [Chickadee Bandit](https://chickadeebandit.com/app-library/announcements) app.

Post household announcements with admin approval, expiration, and notification support — to everyone, a group or chosen members, with optional email and attachments.

## Features

- Admin approval before an announcement is published; a moderator group approves. Approval is a row in `approvals`, which only that group (or the hub's `post` automation action) can insert. Inserting it sets `approved_flag` through a hub write effect, and deleting it recomputes the flag, so the share link and glance stop as soon as an approval is removed. No app write can set that column, and an approval row can never be moved to another announcement. The share link and the dashboard glance read the flag, never `status`, which is the author's own column. An announcement's title, body, author name and posting time can never be edited once it is posted, by its author or anyone else, so what a moderator approved is what a share link shows. To change one, delete it and post again; only its expiry can be extended.
- Expiration dates, and a critical flag that asks the audience to acknowledge.
- An audience per announcement: everyone, one hub member group, or chosen members. It decides who gets the push and the optional email when the announcement is approved. It is not a read restriction: every member can still open an approved announcement in the app.
- The acknowledgements view names who in the audience has not acknowledged yet.
- Up to five attachments (PDF, image, Word or text) per announcement, added by its author at compose time. Post is refused while an attachment is still uploading. They show in the app, never on a share link.
- A read-only share link for people outside the household, for an approved announcement. The link keeps serving after the announcement expires, until it is revoked or deleted.

## Who is told

Push goes to the audience through the hub, which honours each member's mute and quiet hours. Email is a second, opt-in channel per announcement, plan-gated, per-member opt-out-able and metered against the household's monthly email limit; the app reports what the hub did. An audience that names nobody the app admits (a deleted group, members who have left) sends nothing and says so rather than falling back to everyone. In a roster space a non-steward's audience collapses to the steward and themselves, as for every notification.

## Install

In your hub, go to **Apps → Install from URL** and paste:

```
https://github.com/firebirdsystems/chickadeebandit-announcements/releases/latest/download/bundle.json
```

## Development

See the [app-template](https://github.com/firebirdsystems/chickadeebandit-app-template) for build instructions and the full manifest field reference.
