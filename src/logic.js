export { memberColor, initial, esc, isAdult, formatRelativeDate, AVATAR_COLORS } from "./shared.js";

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
