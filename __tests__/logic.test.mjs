import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  defaultExpiry,
  isExpired,
  effectiveStatus,
  sortAnnouncements,
  formatExpiryDate,
  esc,
  initial,
  isAdult,
} from "../src/logic.js";

// ── defaultExpiry ─────────────────────────────────────────────────────────────

describe("defaultExpiry", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    expect(defaultExpiry()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a date approximately 7 days from now", () => {
    const result = new Date(defaultExpiry());
    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    const diffMs = Math.abs(result - expected);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000); // within 1 day
  });
});

// ── isExpired ─────────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns true for a past date", () => {
    expect(isExpired("2000-01-01")).toBe(true);
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
