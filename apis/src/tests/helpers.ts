import { openDatabase } from "../db/index.js";
import { applyMigrations } from "../db/migrate.js";
import { hashPassword } from "../auth/password.js";

/**
 * Builds a brand-new migrated database at `dbPath`, ready for tests.
 * Keeps tests hermetic & independent of the developer's working database.
 */
export function setupTestDatabase(dbPath: string): import("better-sqlite3").Database {
  const db = openDatabase(dbPath);
  applyMigrations(dbPath);
  return db;
}

export function makeAdmin(
  db: import("better-sqlite3").Database,
  email: string,
  fullName: string,
  password: string
): number {
  const res = db
    .prepare("INSERT INTO users (email, full_name, password_hash, role_code) VALUES (?, ?, ?, 'administrator')")
    .run(email, fullName, hashPassword(password));
  return Number(res.lastInsertRowid);
}

export function makeUser(
  db: import("better-sqlite3").Database,
  email: string,
  fullName: string,
  roleCode: string,
  password: string
): number {
  const res = db
    .prepare("INSERT INTO users (email, full_name, password_hash, role_code) VALUES (?, ?, ?, ?)")
    .run(email, fullName, hashPassword(password), roleCode);
  return Number(res.lastInsertRowid);
}

export { hashPassword };
