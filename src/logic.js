export { memberColor, initial, esc, isAdult, formatRelativeDate, AVATAR_COLORS } from "./shared.js";
import { isAdult } from "./shared.js";

/**
 * Whether `me` may moderate — approve/reject announcements and send the approval
 * notification. Mirrors the server: the `approvals` table is
 * `insert_privileged_only` and the `announcements` moderator bypass +
 * `notification_acls.send` are gated by the configured moderator group
 * (moderator_group_id).
 *
 * MUST match the hub's privileged resolution exactly: privileged IFF the
 * moderator group is configured, still exists, and the member is in it. There is
 * NO "all adults" fallback when the group is unset or dangling — the hub rejects
 * every privileged write in that state, so moderation controls stay hidden here
 * too (otherwise every action would be a silent 403). See
 * __tests__/helpers/privileged-gate.mjs.
 *
 * @param {object|null} me
 * @param {Array}  groups
 * @param {string|null} moderatorGroupId
 */
export function canModerate(me, groups, moderatorGroupId) {
  if (!me || !moderatorGroupId) return false;
  const g = groups.find(g => g.id === moderatorGroupId);
  return !!g && g.memberIds.includes(me.id);
}

/**
 * Whether a member may read who acknowledged a critical announcement. Mirrors
 * the hub's rule for the acknowledgements table (owner_only): any adult in a
 * household, and only the steward in a shared space. The moderator group plays
 * no part in it, and everyone else reads their own acknowledgement alone.
 */
export function supervisesAcknowledgements(member, { tenantKind = "household", isAdmin = false } = {}) {
  return tenantKind === "household" ? isAdult(member) : isAdmin === true;
}

const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Today as a bare `YYYY-MM-DD` on the viewer's own calendar. Never
 * `toISOString().slice(0, 10)`: that is UTC, so west of Greenwich it names
 * YESTERDAY for the whole evening.
 *
 * `expires_at` is a bare date — it comes straight off `<input type="date">` —
 * so everything compared against it must be a bare date too. Comparing it to an
 * instant is a lexical string compare in which "2026-08-30" sorts BEFORE
 * "2026-08-30 14:22:00", which silently swallows the entire expiry day.
 */
export function todayDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultExpiry(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
  return todayDate(d);
}

/**
 * Expiry is INCLUSIVE of the day named: "Expires on the 30th" stays live all
 * day on the 30th and archives when the 31st begins.
 */
export function isExpired(expiresAt, today = todayDate()) {
  return String(expiresAt).slice(0, 10) < today;
}

export function effectiveStatus(ann, today = todayDate()) {
  if (ann.status === "approved" && isExpired(ann.expires_at, today)) return "archived";
  return ann.status;
}

/**
 * Whether the Share button is offered. The hub mints on any row but serves the
 * page only while `visible_where` (approved_flag = "yes") holds, so a link on
 * an unapproved row would be dead on arrival. The flag, not `status`: the hub
 * sets it only when a moderator's approval row is inserted, while `status` is
 * the author's own column. Expiry is not part of it: the hub never derives
 * "archived" from expires_at, so an approved but expired page still serves.
 */
export function canShareAnnouncement(ann) {
  return ann?.approved_flag === "yes";
}

export function sortAnnouncements(list) {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function formatExpiryDate(iso) {
  // Built from parts, not `new Date(iso)`: a bare "YYYY-MM-DD" parses as UTC
  // midnight, which renders as the PREVIOUS day west of Greenwich.
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dt = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(y, m - 1, d)
    : new Date(iso);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * The body and the author both count — an announcement is looked up
 * by what it said and who posted it, which is what people remember
 * weeks later rather than the headline.
 */
export function searchableFields(item) {
  return [item.title, item.body, item.author_name];
}

// ── Retry after a lost response (app-template guide) ─────────────────────────

/**
 * Whether a failed create's answer leaves its outcome unknown — no status, a
 * 400, or a 5xx other than 507 — so the page reads the row back by its pinned
 * id. A `UNIQUE_CONSTRAINT` answer is a 400 too: the usual retry of a create
 * that landed collides on its own pinned id. Only finding the row under that
 * id says it landed.
 */
export function outcomeUnknown(e) {
  if (e?.code === "UNIQUE_CONSTRAINT" || /UNIQUE constraint failed/i.test(String(e?.message ?? ""))) return true;
  const status = Number(e?.status) || 0;
  return status === 0 || status === 400 || (status >= 500 && status !== 507);
}

/**
 * Whether a stored row differs from what the form holds now, over the form's
 * own fields only, compared as text with a missing value as empty.
 */
export function storedDiffers(row, fields) {
  return Object.keys(fields).some((k) => String(row?.[k] ?? "") !== String(fields[k] ?? ""));
}

export const SAVED_AS_FIRST = "Saved as first entered — check it and update what changed.";

/**
 * The line a failed write shows ("Refused, gone, or failed" in the app-template
 * guide): "try again" only when retrying can work. `action` and `thing` are the
 * app's own words. `found` is the caller's re-read after a write that changed
 * nothing: false = the row is gone, true = it is still there, null = the
 * re-read failed. A row still there after a plain `WHERE id = ?` write means
 * the row policy refused it; only a `guarded` write (one with a state
 * condition) can have been "changed by someone else". Decided from the error's
 * `status` / `code`, never from the hub's or the browser's text.
 */
export function failureLine(e, { action, thing, found, guarded = false } = {}) {
  if (e?.forUser) return e.message;
  if (e?.code === "UNIQUE_CONSTRAINT" || /UNIQUE constraint failed/i.test(String(e?.message ?? ""))) return `That ${thing} already exists.`;
  if (e?.status === 403 || (found === true && !guarded)) return `You don’t have permission to ${action}.`;
  if (e?.status === 507) return "The household’s storage is full — free up space first.";
  if (e?.status === 429) return "Too many tries — wait a minute and try again.";
  if (found === null) return `Couldn’t ${action} — try again.`;
  if (found === false || (found === undefined && e?.status === 404)) return `This ${thing} has been removed.`;
  if (found === true || e?.status === 409) return `This ${thing} was changed by someone else — check it first.`;
  return `Couldn’t ${action} — try again.`;
}

// ── Audience: who an approved announcement is delivered to ───────────────────

export const AUDIENCE_KINDS = ["everyone", "group", "members"];

/** A JSON array of strings (member ids), read defensively. */
export function parseStrings(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === "string") : [];
  } catch { return []; }
}

/**
 * The member ids an announcement's push and email go to. `appMembers` is the
 * set the hub admits to this app (`family.app_members`), falling back to the
 * roster; a group's members are intersected with it so nobody the app does
 * not admit is counted. An unknown kind, a missing group or an empty list
 * means NOBODY, never everyone: a delivery choice that cannot be read must not
 * widen into a broadcast.
 */
export function audienceIds(ann, { groups = [], appMembers = null, members = [] } = {}) {
  const admitted = new Set((appMembers ?? members).map(m => m.id));
  const kind = ann?.audience_kind ?? "everyone";
  if (kind === "everyone") return [...admitted];
  if (kind === "group") {
    const group = groups.find(g => g.id === ann.audience_group_id);
    return (group?.memberIds ?? []).filter(id => admitted.has(id));
  }
  if (kind === "members") return parseStrings(ann.audience_member_ids).filter(id => admitted.has(id));
  return [];
}

/** What `sendHubNotification` / the send endpoint is given: "all" for an
 *  everyone announcement (the hub resolves it, mutes and all), else the ids,
 *  or null when there is nobody to tell. */
export function notifyAudience(ann, ctx) {
  if ((ann?.audience_kind ?? "everyone") === "everyone") return "all";
  const ids = audienceIds(ann, ctx);
  return ids.length ? ids : null;
}

/** `complete` says whether the viewer's members and groups are the whole
 *  roster. A roster participant sees only the steward and themselves, so an
 *  id or group they cannot resolve is someone else's, not a deleted one. */
export function audienceLabel(ann, { groups = [], members = [], complete = true } = {}) {
  const kind = ann?.audience_kind ?? "everyone";
  if (kind === "group") {
    const group = groups.find(g => g.id === ann.audience_group_id);
    if (group) return `Group: ${group.name}`;
    return complete ? "A group that no longer exists" : "A group";
  }
  if (kind === "members") {
    const ids = parseStrings(ann.audience_member_ids);
    const names = ids.map(id => members.find(m => m.id === id)?.name).filter(Boolean);
    if (names.length === 0) return complete ? "Chosen members (none left)" : "Chosen members";
    // With some names hidden from this viewer, the count would be wrong; say "others".
    if (!complete && ids.length > names.length) return `${names.slice(0, 3).join(", ")} and others`;
    return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  }
  return "Everyone";
}

/** What the page says about the email channel after a send, worded for the
 *  action that caused it ("posted" or "approved") and for its audience: an
 *  announcement to a group is not "emailed to everyone". Null when there is
 *  nothing to say. */
export function emailOutcomeLine(email, { done = "posted", audienceKind = "everyone" } = {}) {
  if (!email || typeof email !== "object") return null;
  const lead = `Announcement ${done}`;
  const who = audienceKind === "everyone" ? "everyone" : "its audience";
  switch (email.reason) {
    case undefined:
    case null:
      break;
    case "not_entitled": return `${lead}. Emailing ${who} needs an active plan.`;
    case "no_transport": return `${lead}, but email isn't configured for this hub.`;
    case "no_recipients": return `${lead}. Nobody it was sent to has an address set, so no email went out.`;
    case "quota_exhausted": return `${lead}, but this household hit its monthly email limit.`;
    default: return `${lead} without email.`;
  }
  const sent = Number(email.sent) || 0;
  return sent > 0 ? `${lead} and emailed to ${sent} ${sent === 1 ? "person" : "people"}.` : null;
}

/** The compose form's audience, normalised, or the reason it is not valid. */
export function audienceDraft({ kind, groupId, memberIds } = {}) {
  const cleanKind = AUDIENCE_KINDS.includes(kind) ? kind : "everyone";
  const cleanGroup = cleanKind === "group" ? String(groupId ?? "").trim() : "";
  if (cleanKind === "group" && !cleanGroup) return { error: "Choose the group this announcement is for." };
  const ids = cleanKind === "members" ? [...new Set(parseStrings(memberIds))] : [];
  if (cleanKind === "members" && ids.length === 0) return { error: "Choose at least one member." };
  return { value: { audience_kind: cleanKind, audience_group_id: cleanGroup || null, audience_member_ids: JSON.stringify(ids) } };
}

/** Whether this member is asked to acknowledge a critical announcement:
 *  everyone is, for an announcement to everyone; otherwise only the members
 *  it was sent to. Anyone may still read it; only its audience is asked. */
export function asksToAcknowledge(ann, memberId, ctx) {
  if (!ann?.is_critical) return false;
  if ((ann.audience_kind ?? "everyone") === "everyone") return true;
  return !!memberId && audienceIds(ann, ctx).includes(memberId);
}

/** Members in the audience who have not acknowledged yet, for the
 *  acknowledgements view. Acknowledgements from outside the audience are
 *  still listed by the caller; this only names who is still to act. */
export function notAcknowledged(ann, ackRows, ctx) {
  const acked = new Set((ackRows ?? []).map(r => r.member_id));
  return audienceIds(ann, ctx).filter(id => !acked.has(id));
}

/** Hub file ids are UUIDs; an attachment row its author can rewrite by raw
 *  SQL is checked to that shape before its id reaches a URL the page builds. */
export function isFileId(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);
}

export const MAX_ATTACHMENTS = 5;

/** The line a failed attachment upload shows: the upload's own refusals first. */
export function uploadFailureLine(e) {
  if (e?.status === 413) return "That file is too large.";
  if (e?.status === 415) return "That kind of file can’t be uploaded.";
  return failureLine(e, { action: "attach that file", thing: "file" });
}
