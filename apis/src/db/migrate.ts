/**
 * Versioned migration runner.
 *
 * - Reads numbered *.sql files from db/migrations/ (sorted by name).
 * - Tracks applied migrations in the `migration_history` table.
 * - Applies each pending migration inside a transaction.
 * - Idempotent: running it again with no new files is a no-op.
 */
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../config.js";
import { openDatabase, closeDatabase, type Db } from "./index.js";

const MIGRATIONS_DIR = path.join(repoRoot, "db", "migrations");

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function ensureMigrationTable(db: Db): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS migration_history (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"
  );
}

/** Applies all pending migrations; returns the names applied. */
export function applyMigrations(dbPath?: string): { applied: string[]; skipped: string[] } {
  const db = openDatabase(dbPath);
  try {
    ensureMigrationTable(db);
    const appliedSet = new Set(
      (db.prepare("SELECT name FROM migration_history").all() as { name: string }[]).map((r) => r.name)
    );
    const applied: string[] = [];
    const skipped: string[] = [];
    for (const file of listMigrationFiles()) {
      if (appliedSet.has(file)) {
        skipped.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      const tx = db.transaction(() => {
        db.exec(sql); // migration files must not rely on implicit ordering with forks
        db.prepare("INSERT INTO migration_history (name) VALUES (?)").run(file);
      });
      tx();
      applied.push(file);
    }
    return { applied, skipped };
  } finally {
    closeDatabase();
  }
}

export function migrationStatus(dbPath?: string): { name: string; appliedAt: string | null }[] {
  const db = openDatabase(dbPath);
  try {
    ensureMigrationTable(db);
    const history = new Map(
      (db.prepare("SELECT name, applied_at FROM migration_history").all() as { name: string; applied_at: string }[]).map(
        (r) => [r.name, r.applied_at]
      )
    );
    return listMigrationFiles().map((name) => ({ name, appliedAt: history.get(name) ?? null }));
  } finally {
    closeDatabase();
  }
}

function main(): void {
  if (process.argv.includes("--status")) {
    console.table(migrationStatus());
    return;
  }
  const { applied, skipped } = applyMigrations();
  for (const name of applied) console.log(`applied  : ${name}`);
  for (const name of skipped) console.log(`already up: ${name}`);
  if (applied.length === 0) console.log("No pending migrations.");
  console.log(
    `Database: ${process.env.DATABASE_PATH || "db/data/unicore.db"} — back it up before schema changes.`
  );
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  main();
}
