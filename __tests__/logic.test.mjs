import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  defaultExpiry,
  isExpired,
  effectiveStatus,
  sortAnnouncements,
  formatExpiryDate,
  todayDate,
  esc,
  initial,
  isAdult,
  canModerate, searchableFields, supervisesAcknowledgements,
  audienceIds, notifyAudience, audienceLabel, audienceDraft, notAcknowledged, asksToAcknowledge, isFileId, parseStrings, emailOutcomeLine,
} from "../src/logic.js";
import { testPrivilegedGateContract } from "./helpers/privileged-gate.mjs";

// ── canModerate ───────────────────────────────────────────────────────────────
// Fronts the approvals insert_privileged_only policy + announcements moderator
// bypass + notification send ACL (moderator_group_id), so it must satisfy the
// shared privileged-gate contract (mirrors the hub: no fallback when unconfigured).

testPrivilegedGateContract("canModerate", canModerate, {
  member:   { id: "a1", role: "adult" },
  outsider: { id: "a3", role: "adult" },
  groups:   [{ id: "g1", memberIds: ["a1", "a2"] }],
  groupId:  "g1",
});

// ── defaultExpiry ─────────────────────────────────────────────────────────────

describe("defaultExpiry", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    expect(defaultExpiry()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns exactly 7 days from today", () => {
    // Compared as DATES, not as instants. The old form parsed the result with
    // `new Date("2026-09-06")` — UTC midnight — and measured it against a local
    // `new Date()`, so the gap exceeded 24h whenever the local time of day plus
    // the UTC offset did. It only looked stable because `defaultExpiry` was
    // itself UTC and the two errors cancelled.
    const anchor = new Date(2026, 7, 30, 23, 30);   // local, late evening
    expect(defaultExpiry(anchor)).toBe("2026-09-06");
    expect(defaultExpiry(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-08");
  });

  it("lands 7 days after today whatever the clock says", () => {
    const seven = new Date(`${todayDate()}T00:00:00Z`);
    seven.setUTCDate(seven.getUTCDate() + 7);
    expect(defaultExpiry()).toBe(seven.toISOString().slice(0, 10));
  });
});

// ── todayDate ─────────────────────────────────────────────────────────────────

// Regression guards for the UTC-drift bug: `toISOString().slice(0, 10)` names
// the WRONG calendar day for part of every day outside UTC. Both directions are
// pinned so a revert fails wherever CI's TZ is set (under TZ=UTC there is
// genuinely nothing to catch and both trivially hold).
describe("todayDate", () => {
  it("uses the LOCAL calendar day late in the evening (fails under UTC drift west of Greenwich)", () => {
    expect(todayDate(new Date(2026, 0, 1, 23, 30))).toBe("2026-01-01");
  });

  it("uses the LOCAL calendar day early in the morning (fails under UTC drift east of Greenwich)", () => {
    expect(todayDate(new Date(2026, 0, 2, 0, 30))).toBe("2026-01-02");
  });

  it("agrees with the platform's own local-date formatting", () => {
    expect(todayDate()).toBe(new Date().toLocaleDateString("en-CA"));
  });
});

// ── isExpired ─────────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns true for a past date", () => {
    expect(isExpired("2000-01-01")).toBe(true);
  });

  // The bug this replaces: `expires_at` (a bare date) was compared against an
  // instant, a lexical compare in which "2026-08-30" sorts BEFORE
  // "2026-08-30 14:22:00" — so an announcement vanished on the very day it was
  // labelled "Expires <today>".
  it("keeps the expiry day itself LIVE", () => {
    expect(isExpired(todayDate())).toBe(false);
  });

  it("expires only once the next day begins", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isExpired(todayDate(d))).toBe(true);
  });

  it("accepts a full ISO instant as well as a bare date", () => {
    expect(isExpired(`${todayDate()}T00:00:00.000Z`)).toBe(false);
  });

  it("treats the freshly defaulted expiry as live", () => {
    expect(isExpired(defaultExpiry())).toBe(false);
  });

  it("returns false for a future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isExpired(future.toISOString().slice(0, 10))).toBe(false);
  });
});

// ── effectiveStatus ───────────────────────────────────────────────────────────

describe("effectiveStatus", () => {
  it("returns 'archived' for approved announcement with past expiry", () => {
    const ann = { status: "approved", expires_at: "2000-01-01" };
    expect(effectiveStatus(ann)).toBe("archived");
  });

  it("returns 'approved' for approved announcement with future expiry", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const ann = { status: "approved", expires_at: future.toISOString().slice(0, 10) };
    expect(effectiveStatus(ann)).toBe("approved");
  });

  it("returns 'approved' on the expiry day itself", () => {
    const ann = { status: "approved", expires_at: todayDate() };
    expect(effectiveStatus(ann)).toBe("approved");
  });

  it("returns 'pending' for pending announcement regardless of expiry", () => {
    const ann = { status: "pending", expires_at: "2000-01-01" };
    expect(effectiveStatus(ann)).toBe("pending");
  });

  it("returns 'archived' for archived announcement", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const ann = { status: "archived", expires_at: future.toISOString().slice(0, 10) };
    expect(effectiveStatus(ann)).toBe("archived");
  });
});

// ── sortAnnouncements ─────────────────────────────────────────────────────────

describe("sortAnnouncements", () => {
  it("sorts newest first", () => {
    const items = [
      { id: "a", created_at: "2024-01-01T00:00:00.000Z" },
      { id: "b", created_at: "2024-03-01T00:00:00.000Z" },
      { id: "c", created_at: "2024-02-01T00:00:00.000Z" },
    ];
    const sorted = sortAnnouncements(items);
    expect(sorted.map(i => i.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "x", created_at: "2024-01-01T00:00:00.000Z" },
      { id: "y", created_at: "2024-06-01T00:00:00.000Z" },
    ];
    const original = [...items];
    sortAnnouncements(items);
    expect(items).toEqual(original);
  });

  it("handles empty array", () => {
    expect(sortAnnouncements([])).toEqual([]);
  });
});

// ── formatExpiryDate ──────────────────────────────────────────────────────────

describe("formatExpiryDate", () => {
  it("formats a date string to a readable label", () => {
    const result = formatExpiryDate("2025-12-25");
    expect(result).toContain("Dec");
    expect(result).toContain("25");
  });

  // `new Date("2025-12-25")` is UTC midnight and renders as Dec 24 west of
  // Greenwich; the label must name the day the author picked.
  it("names the exact day picked, not the UTC-shifted one", () => {
    expect(formatExpiryDate("2025-12-25")).toContain("Dec 25");
  });
});

// ── esc ───────────────────────────────────────────────────────────────────────

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });
  it("passes plain text through unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
  });
  it("coerces numbers to string", () => {
    expect(esc(42)).toBe("42");
  });
});

// ── initial ───────────────────────────────────────────────────────────────────

describe("initial", () => {
  it("returns uppercase first letter", () => {
    expect(initial("alice")).toBe("A");
  });
  it("handles leading whitespace", () => {
    expect(initial("  bob")).toBe("B");
  });
  it("returns ? for empty string", () => {
    expect(initial("")).toBe("?");
  });
  it("returns ? for null", () => {
    expect(initial(null)).toBe("?");
  });
});

// ── isAdult ───────────────────────────────────────────────────────────────────

describe("isAdult", () => {
  it("returns true for role=adult", () => {
    expect(isAdult({ role: "adult" })).toBe(true);
  });
  it("returns true for role=admin", () => {
    expect(isAdult({ role: "admin" })).toBe(true);
  });
  it("returns true for role=owner", () => {
    expect(isAdult({ role: "owner" })).toBe(true);
  });
  it("returns false for role=child", () => {
    expect(isAdult({ role: "child" })).toBe(false);
  });
  it("returns false for null", () => {
    expect(isAdult(null)).toBe(false);
  });
});

describe("searchableFields", () => {
  it("matches on the body and the author, not just the headline", () => {
    const fields = searchableFields({
      title: "Pool closed", body: "resurfacing until the 14th", author_name: "Ada",
    });
    expect(fields).toContain("resurfacing until the 14th");
    expect(fields).toContain("Ada");
  });
});

// ── supervisesAcknowledgements ────────────────────────────────────────────────
describe("supervisesAcknowledgements", () => {
  const ADULT = { id: "a1", role: "adult" };
  const CHILD = { id: "c1", role: "child" };
  it("is every adult in a household, which is the default", () => {
    expect(supervisesAcknowledgements(ADULT)).toBe(true);
    expect(supervisesAcknowledgements(ADULT, { tenantKind: "household" })).toBe(true);
  });
  it("is never a child or nobody", () => {
    expect(supervisesAcknowledgements(CHILD)).toBe(false);
    expect(supervisesAcknowledgements(null)).toBe(false);
  });
  it("is not an adult who takes part in a shared space or a roster", () => {
    expect(supervisesAcknowledgements(ADULT, { tenantKind: "shared_space", spaceKind: "general", isAdmin: false })).toBe(false);
    expect(supervisesAcknowledgements(ADULT, { tenantKind: "shared_space", spaceKind: "roster", isAdmin: false })).toBe(false);
  });
  it("is the steward of a shared space or a roster", () => {
    expect(supervisesAcknowledgements(ADULT, { tenantKind: "shared_space", spaceKind: "general", isAdmin: true })).toBe(true);
    expect(supervisesAcknowledgements(ADULT, { tenantKind: "shared_space", spaceKind: "roster", isAdmin: true })).toBe(true);
  });
});

// ── Audience ──────────────────────────────────────────────────────────────────
// Who an approved announcement is delivered to. The admitted set
// (family.app_members) bounds every kind; nothing here ever widens to "all"
// from a value it cannot read.

describe("audience", () => {
  const members = [
    { id: "m1", name: "Alex", role: "adult" }, { id: "m2", name: "Jamie", role: "adult" },
    { id: "m3", name: "Casey", role: "child" }, { id: "m4", name: "Robin", role: "adult" },
  ];
  const groups = [{ id: "g1", name: "Board", memberIds: ["m1", "m4"] }];
  const ctx = { groups, members, appMembers: members.slice(0, 3) };
  const ann = (over = {}) => ({ audience_kind: "everyone", audience_group_id: null, audience_member_ids: "[]", ...over });

  it("everyone is the admitted set, and a legacy row with no kind is everyone", () => {
    expect(audienceIds(ann(), ctx)).toEqual(["m1", "m2", "m3"]);
    expect(audienceIds({}, ctx)).toEqual(["m1", "m2", "m3"]);
    expect(audienceIds(ann(), { ...ctx, appMembers: null })).toEqual(["m1", "m2", "m3", "m4"]);
    expect(notifyAudience(ann(), ctx)).toBe("all");
    expect(notifyAudience({}, ctx)).toBe("all");
  });
  it("a group is intersected with the admitted set; a missing group is nobody", () => {
    expect(audienceIds(ann({ audience_kind: "group", audience_group_id: "g1" }), ctx)).toEqual(["m1"]);
    expect(notifyAudience(ann({ audience_kind: "group", audience_group_id: "g1" }), ctx)).toEqual(["m1"]);
    expect(notifyAudience(ann({ audience_kind: "group", audience_group_id: "gone" }), ctx)).toBe(null);
  });
  it("chosen members are filtered to those admitted; an unknown kind is nobody", () => {
    expect(audienceIds(ann({ audience_kind: "members", audience_member_ids: '["m3","m4","zz"]' }), ctx)).toEqual(["m3"]);
    expect(notifyAudience(ann({ audience_kind: "members", audience_member_ids: "[]" }), ctx)).toBe(null);
    expect(notifyAudience(ann({ audience_kind: "all" }), ctx)).toBe(null);
    expect(parseStrings("not json")).toEqual([]);
  });
  it("labels the audience", () => {
    expect(audienceLabel(ann(), ctx)).toBe("Everyone");
    expect(audienceLabel(ann({ audience_kind: "group", audience_group_id: "g1" }), ctx)).toBe("Group: Board");
    expect(audienceLabel(ann({ audience_kind: "group", audience_group_id: "x" }), ctx)).toBe("A group that no longer exists");
    expect(audienceLabel(ann({ audience_kind: "members", audience_member_ids: '["m1","m2","m3","m4"]' }), ctx)).toBe("Alex, Jamie, Casey and 1 more");
    expect(audienceLabel(ann({ audience_kind: "members", audience_member_ids: '["zz"]' }), ctx)).toBe("Chosen members (none left)");
  });
  it("does not call a live audience gone when the viewer sees only part of the roster", () => {
    const partial = { ...ctx, complete: false };
    expect(audienceLabel(ann({ audience_kind: "members", audience_member_ids: '["zz"]' }), partial)).toBe("Chosen members");
    expect(audienceLabel(ann({ audience_kind: "members", audience_member_ids: '["m1","zz"]' }), partial)).toBe("Alex and others");
    expect(audienceLabel(ann({ audience_kind: "group", audience_group_id: "x" }), partial)).toBe("A group");
    // Never "… and 1 more and others".
    const many = { ...partial, members: [...members, { id: "m5", name: "Sam", role: "adult" }] };
    expect(audienceLabel(ann({ audience_kind: "members", audience_member_ids: '["m1","m2","m3","m4","m5","zz"]' }), many)).toBe("Alex, Jamie, Casey and others");
  });
  it("words the email outcome for the action and the audience", () => {
    expect(emailOutcomeLine({ reason: "not_entitled" }, { done: "approved", audienceKind: "group" })).toBe("Announcement approved. Emailing its audience needs an active plan.");
    expect(emailOutcomeLine({ reason: "not_entitled" })).toBe("Announcement posted. Emailing everyone needs an active plan.");
    expect(emailOutcomeLine({ sent: 1 }, { done: "approved" })).toBe("Announcement approved and emailed to 1 person.");
    expect(emailOutcomeLine({ sent: 0 })).toBe(null);
    expect(emailOutcomeLine({ reason: "weird" })).toBe("Announcement posted without email.");
    expect(emailOutcomeLine(null)).toBe(null);
  });
  it("validates the compose form's choice", () => {
    expect(audienceDraft({ kind: "group", groupId: "" }).error).toMatch(/group/);
    expect(audienceDraft({ kind: "members", memberIds: [] }).error).toMatch(/member/);
    expect(audienceDraft({ kind: "weird" }).value).toEqual({ audience_kind: "everyone", audience_group_id: null, audience_member_ids: "[]" });
    expect(audienceDraft({ kind: "members", memberIds: ["m1", "m1", "m2"] }).value.audience_member_ids).toBe('["m1","m2"]');
    expect(audienceDraft({ kind: "group", groupId: "g1", memberIds: ["m1"] }).value).toEqual({ audience_kind: "group", audience_group_id: "g1", audience_member_ids: "[]" });
  });
  it("names who in the audience has not acknowledged", () => {
    expect(notAcknowledged(ann(), [{ member_id: "m1" }, { member_id: "m4" }], ctx)).toEqual(["m2", "m3"]);
    expect(notAcknowledged(ann({ audience_kind: "members", audience_member_ids: '["m2"]' }), [{ member_id: "m2" }], ctx)).toEqual([]);
  });
  it("asks only the audience to acknowledge a critical announcement", () => {
    const critical = (over) => ann({ is_critical: 1, ...over });
    expect(asksToAcknowledge(critical(), "m4", ctx)).toBe(true);
    expect(asksToAcknowledge(critical(), null, ctx)).toBe(true);
    expect(asksToAcknowledge(critical({ audience_kind: "members", audience_member_ids: '["m2"]' }), "m2", ctx)).toBe(true);
    expect(asksToAcknowledge(critical({ audience_kind: "members", audience_member_ids: '["m2"]' }), "m1", ctx)).toBe(false);
    expect(asksToAcknowledge(critical({ audience_kind: "members", audience_member_ids: '["m2"]' }), null, ctx)).toBe(false);
    expect(asksToAcknowledge(ann({ is_critical: 0 }), "m1", ctx)).toBe(false);
  });
  it("holds attachment ids to the hub file-id shape", () => {
    expect(isFileId("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(true);
    expect(isFileId("0f8fad5b-d9cb-469f-a165-70867728950e/../x")).toBe(false);
    expect(isFileId(7)).toBe(false);
  });
});
