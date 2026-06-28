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

export function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
  return d.toISOString().slice(0, 10);
}

export function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

export function effectiveStatus(ann) {
  if (ann.status === "approved" && isExpired(ann.expires_at)) return "archived";
  return ann.status;
}

export function sortAnnouncements(list) {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function formatExpiryDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
