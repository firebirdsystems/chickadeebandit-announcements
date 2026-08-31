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
  canModerate, searchableFields,
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
