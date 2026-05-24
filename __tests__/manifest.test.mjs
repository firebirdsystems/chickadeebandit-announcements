import { readFileSync } from "fs";
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
