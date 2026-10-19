import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export type Db = Database.Database;

let instance: Db | null = null;

/** Opens (and creates) the SQLite database with the right pragmas. */
export function openDatabase(dbPath: string = config.databasePath): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/** Shared connection for the API process. */
export function getDb(): Db {
  if (!instance) instance = openDatabase();
  return instance;
}

export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

/** Run `fn` inside a single transaction; rolls back on any exception. */
export function withTransaction<T>(db: Db, fn: () => T): T {
  return db.transaction(fn)();
}

export function nowIso(): string {
  return new Date().toISOString().replace("Z", "") + "Z";
}
