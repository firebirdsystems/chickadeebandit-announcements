import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });

  it("publishes is an array of strings", () => {
    expect(Array.isArray(manifest.publishes)).toBe(true);
    for (const e of manifest.publishes) expect(typeof e).toBe("string");
  });

  it("alert_on is an array of strings", () => {
    expect(Array.isArray(manifest.alert_on)).toBe(true);
    for (const e of manifest.alert_on) expect(typeof e).toBe("string");
  });

  it("alert_on events are a subset of publishes", () => {
    for (const e of manifest.alert_on) {
      expect(manifest.publishes).toContain(e);
    }
  });

  it("has nav with a label", () => {
    expect(manifest.nav?.label).toBeTruthy();
  });

  it("has widget with a label and valid size", () => {
    expect(manifest.widget?.label).toBeTruthy();
    expect(["small", "medium", "large"]).toContain(manifest.widget?.size);
  });
});

// ── ai_access SQL file validation ─────────────────────────────────────────────
if (manifest.ai_access) {
  const ai = manifest.ai_access;

  const SQL_TYPES = [
    { field: "db_exports",   dir: "queries",   keyword: /^(SELECT|WITH)\b/i, label: "SELECT or WITH" },
    { field: "db_mutations", dir: "mutations",  keyword: /^UPDATE\b/i,        label: "UPDATE"         },
    { field: "db_inserts",   dir: "inserts",    keyword: /^INSERT\b/i,        label: "INSERT"         },
    { field: "db_deletes",   dir: "deletes",    keyword: /^DELETE\b/i,        label: "DELETE"         },
  ];

  for (const { field, dir, keyword, label } of SQL_TYPES) {
    const names = ai[field] ?? [];
    if (names.length === 0) continue;

    describe(`ai_access.${field}`, () => {
      it(`each name has a src/${dir}/{name}.sql file`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          expect(existsSync(path), `missing: src/${dir}/${name}.sql`).toBe(true);
        }
      });

      it(`each SQL file starts with ${label}`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8").trim();
          expect(
            keyword.test(sql),
            `src/${dir}/${name}.sql must start with ${label}, got: ${sql.slice(0, 50)}`
          ).toBe(true);
        }
      });

      it(`each SQL file is a single statement (no semicolons)`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(sql.includes(";"), `src/${dir}/${name}.sql must not contain semicolons`).toBe(false);
        }
      });
    });
  }

  if (ai.db_inserts?.length) {
    describe("ai_access.db_inserts schemas", () => {
      it("each insert has a src/schemas/{name}.json file", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          expect(existsSync(path), `missing: src/schemas/${name}.json`).toBe(true);
        }
      });

      it("each schema file is valid JSON", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          expect(() => JSON.parse(readFileSync(path, "utf-8")), `src/schemas/${name}.json must be valid JSON`).not.toThrow();
        }
      });

      it("each schema declares type:array with an items definition", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          let schema;
          try { schema = JSON.parse(readFileSync(path, "utf-8")); } catch { continue; }
          expect(schema.type, `src/schemas/${name}.json must declare "type": "array"`).toBe("array");
          expect(
            Array.isArray(schema.items) || (typeof schema.items === "object" && schema.items !== null),
            `src/schemas/${name}.json must declare "items" to validate params`
          ).toBe(true);
        }
      });

      it("schema maxItems matches the number of $N placeholders in the SQL", () => {
        for (const name of ai.db_inserts) {
          const sqlPath    = join(__dirname, `../src/inserts/${name}.sql`);
          const schemaPath = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(sqlPath) || !existsSync(schemaPath)) continue;
          const sql = readFileSync(sqlPath, "utf-8");
          let schema;
          try { schema = JSON.parse(readFileSync(schemaPath, "utf-8")); } catch { continue; }
          const paramNums = [...sql.matchAll(/\$(\d+)/g)].map(m => parseInt(m[1], 10));
          const maxParam  = paramNums.length > 0 ? Math.max(...paramNums) : 0;
          expect(
            schema.maxItems,
            `src/schemas/${name}.json maxItems (${schema.maxItems}) must equal SQL $N count (${maxParam})`
          ).toBe(maxParam);
        }
      });
    });
  }
}

// Member removal (manifest.member_references). Authorship and approval are
// household record — an announcement does not lose its author because the
// author left, and the app renders a fallback for an id it cannot resolve.
// Acknowledgements are the opposite: they are counted ("N of M acknowledged"),
// so a departed member's row would keep inflating a critical announcement's
// tally forever. The table is keyed (announcement_id, member_id) with no `id`
// column, hence the rowid escape hatch.
describe("member_references", () => {
  it("keeps attribution and deletes acknowledgements", () => {
    expect(manifest.member_references).toEqual({
      announcements: [
        { column: "author_id", on_removed: "keep" },
        { column: "approved_by", on_removed: "keep" },
      ],
      approvals: { column: "approved_by", on_removed: "keep" },
      acknowledgements: { column: "member_id", on_removed: "delete", id_column: "rowid" },
    });
  });
});

// Nothing ever removed an announcement, and an announcement is not one row: it
// owns an approval and one acknowledgement per member. Retention ages the
// announcement out and cascades, keyed on created_at rather than expires_at —
// expiry is a display rule the app already honours, retention is how long the
// record is kept. The hub requires an index leading on the timestamp column,
// which is what migration 007 adds (the only prior index leads with `status`).
describe("retention", () => {
  it("expires announcements and cascades to their child rows", () => {
    expect(manifest.row_policies.announcements.retain_days).toEqual({
      default: 365,
      timestamp_column: "created_at",
      override_key: "announcement_history",
      dependent_tables: [
        { table: "approvals", foreign_key: "announcement_id" },
        { table: "acknowledgements", foreign_key: "announcement_id" },
      ],
    });
  });

  it("indexes the retention timestamp", () => {
    const sql = readFileSync(join(__dirname, "../migrations/007_retention_index.sql"), "utf-8");
    expect(sql).toMatch(/ON app_announcements__announcements \(created_at\)/);
  });
});
