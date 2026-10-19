import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyMigrations, migrationStatus } from "../db/migrate.js";
import { openDatabase } from "../db/index.js";

let tmpDir = "";
let dbPath = "";

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-mig-"));
  dbPath = path.join(tmpDir, "mig-test.db");
});

after(() => {
  // Windows can hold the WAL/shm files briefly; cleanup is best-effort only.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("migration runner", () => {
  test("applies the initial migration and records history", () => {
    const { applied } = applyMigrations(dbPath);
    assert.equal(applied.length, 1);
    assert.equal(applied[0], "001_init.sql");
    const db = openDatabase(dbPath);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]
    ).map((r) => r.name);
    for (const expected of ["users", "students", "employees", "fee_charges", "payments", "payment_allocations", "migration_history", "settings"]) {
      assert.ok(tables.includes(expected), `missing table ${expected}`);
    }
    db.close();
  });

  test("running again is a no-op (nothing applied twice)", () => {
    const { applied } = applyMigrations(dbPath);
    assert.equal(applied.length, 0);
    const status = migrationStatus(dbPath);
    assert.equal(status.length >= 1, true);
    assert.ok(status.every((s) => s.appliedAt !== null));
  });

  test("migration_history prevents duplicate application", () => {
    const db = openDatabase(dbPath);
    const rows = db.prepare("SELECT COUNT(*) AS n FROM migration_history").get() as { n: number };
    assert.equal(rows.n, 1);
    db.close();
  });
});
