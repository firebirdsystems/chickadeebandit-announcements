import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { canShareAnnouncement } from "../src/logic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const page = readFileSync(join(__dirname, "../src/index.html"), "utf-8");

const item = manifest.shareable?.announcement;

// Mirrors the hub's BUILTIN_APP_DB_PLAINTEXT_COLS + suffix rules
// (packages/hub/src/cloudflare/manifest-common.ts). visible_where is an
// equality in SQL; against an AES-GCM column it would silently match nothing.
const BUILTIN_PLAINTEXT = new Set([
  "id", "household_id", "created_at", "updated_at", "sent_at", "read_at",
  "expires_at", "last_synced_at", "completed", "all_day",
  "status", "type", "category", "week", "emoji", "icon",
]);
function isPlaintext(column) {
  return (
    BUILTIN_PLAINTEXT.has(column) ||
    /_(id|at|date|by)$/.test(column) ||
    (manifest.db_plaintext_columns ?? []).includes(column)
  );
}

/**
 * A share link is an anonymous read that skips row policies, so the declared
 * columns are the whole public surface. Moderation and acknowledgement are
 * household business: the page carries what was said and when, nothing about
 * who said it, who let it through or who has read it.
 */
describe("shareable.announcement", () => {
  it("anchors on the announcements table by id", () => {
    expect(item.table).toBe("announcements");
    expect(item.id_column ?? "id").toBe("id");
    expect(item.title_column).toBe("title");
  });

  it("projects exactly the announcement's text and posted date", () => {
    expect(item.columns.map((c) => c.column)).toEqual(["body", "created_at"]);
    const text = JSON.stringify(item);
    for (const leak of ["author_id", "author_name", "approved_by", "approved_at", "acknowledgements", "approvals"]) {
      expect(text).not.toContain(leak);
    }
  });

  // Share reads BYPASS row policies, so this is the only gate on the public
  // page. It reads the flag only an approval row sets, never `status`, which
  // the author writes and could set to "approved" without a moderator.
  it("serves moderator-approved announcements only, on a column no app write reaches", () => {
    expect(item.visible_where).toEqual({ column: "approved_flag", values: ["yes"] });
    expect(isPlaintext("approved_flag")).toBe(true);
    expect(manifest.row_policies.announcements.column_write_acls.approved_flag).toEqual({ writable_by: [] });
    // What a moderator approved is what the link serves: the content the
    // share page shows can never be edited after posting, by anyone.
    for (const column of ["id", "title", "body", "author_name", "created_at"]) {
      expect(manifest.row_policies.announcements.column_write_acls[column]).toEqual({ writable_by: [], actions: ["update"] });
    }
    // Removing an approval withdraws the flag; an approval can never be moved.
    expect(manifest.write_effects.approvals.delete[0].statement).toMatch(/approved_flag = CASE WHEN EXISTS/);
    expect(manifest.row_policies.approvals.column_write_acls.announcement_id).toEqual({ writable_by: [], actions: ["update"] });
    expect(manifest.write_effects.approvals.insert).toEqual([
      { label: "approved_flag", statement: "UPDATE app_announcements__announcements SET approved_flag = 'yes' WHERE id = :new.announcement_id" },
    ]);
  });

  it("is read-only: no submit form, feed or files", () => {
    expect(item.submit).toBeUndefined();
    expect(item.feed).toBeUndefined();
    expect(item.files).toBeUndefined();
  });

  it("is the item type the page mints", () => {
    expect(Object.keys(manifest.shareable)).toEqual(["announcement"]);
    expect(page).toMatch(/itemType:\s*"announcement"/);
  });

  it("tells the sharer that authorship, approval and acknowledgements stay here", () => {
    const scope = page.match(/scopeHtml:\s*\(\)\s*=>\s*"([^"]+)"/)?.[1] ?? "";
    expect(scope).toMatch(/Who wrote it, who approved it and who has acknowledged it stay here/);
  });

  it("offers Share only through the approval-flag gate", () => {
    expect(page).toMatch(/CAN_SHARE && canShareAnnouncement\(ann\)/);
    expect(page).toContain('data-testid="announcement-share"');
  });
});

// The hub mints on any existing row but serves it only while visible_where
// holds, so offering Share on anything else hands out a dead link.
describe("canShareAnnouncement", () => {
  it("allows an announcement a moderator approved", () => {
    expect(canShareAnnouncement({ status: "approved", approved_flag: "yes", expires_at: "2999-01-01" })).toBe(true);
  });

  it("refuses one without an approval, whatever its author wrote into status", () => {
    expect(canShareAnnouncement({ status: "approved", approved_flag: "no", expires_at: "2999-01-01" })).toBe(false);
    expect(canShareAnnouncement({ status: "pending", approved_flag: "no", expires_at: "2999-01-01" })).toBe(false);
    expect(canShareAnnouncement(null)).toBe(false);
  });

  // The in-app list derives "archived" once expires_at passes; the hub reads the
  // flag, so an expired-but-approved row still serves its page.
  it("keeps an approved-but-expired announcement shareable", () => {
    expect(canShareAnnouncement({ status: "archived", approved_flag: "yes", expires_at: "2000-01-01" })).toBe(true);
  });
});
