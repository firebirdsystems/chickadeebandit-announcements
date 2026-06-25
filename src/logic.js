export { memberColor, initial, esc, isAdult, formatRelativeDate, AVATAR_COLORS } from "./shared.js";

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
  return ann.status;
}

export function sortAnnouncements(list) {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function formatExpiryDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
