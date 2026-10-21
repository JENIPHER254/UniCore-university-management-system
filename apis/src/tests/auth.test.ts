import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, closeServer, http, login, makeDbUser } from "./http.js";
import { setupTestDatabase } from "./helpers.js";
import { verifyPassword, hashPassword } from "../auth/password.js";

let db: import("better-sqlite3").Database;
const ADMIN = { email: "admin@test.local", password: "Passw0rd123" };
const FIN = { email: "fin@test.local", password: "Passw0rd456" };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-auth-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  db = setupTestDatabase(process.env.DATABASE_PATH);
  makeDbUser(db, ADMIN.email, "Admin Tester", "administrator", ADMIN.password);
  makeDbUser(db, FIN.email, "Finance Tester", "finance_officer", FIN.password);
  await startServer();
});

after(async () => {
  await closeServer();
});

describe("authentication", () => {
  test("a seeded user can log in with correct credentials", async () => {
    const res = await login(ADMIN.email, ADMIN.password);
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.token === "string");
    assert.equal(res.body.user.roleCode, "administrator");
  });

  test("wrong password is rejected with 401", async () => {
    const res = await login(ADMIN.email, "wrongpass");
    assert.equal(res.status, 401);
  });

  test("unknown email is rejected with 401", async () => {
    const res = await login("nobody@test.local", "whatever");
    assert.equal(res.status, 401);
  });

  test("password hashes are never stored in plaintext", () => {
    const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get(ADMIN.email) as {
      password_hash: string;
    };
    assert.ok(!row.password_hash.includes(ADMIN.password));
    assert.ok(verifyPassword(ADMIN.password, row.password_hash));
  });

  test("deactivated accounts cannot log in", async () => {
    const email = "inactive@test.local";
    makeDbUser(db, email, "Inactive", "hr_officer", "Passw0rd789", 0);
    const res = await login(email, "Passw0rd789");
    assert.equal(res.status, 401);
  });

  test("protected endpoints require a token", async () => {
    const res = await http("GET", "/api/students");
    assert.equal(res.status, 401);
  });
});

describe("role-based permissions", () => {
  test("finance officer can access HR endpoints (role restrictions removed)", async () => {
    const loginRes = await login(FIN.email, FIN.password);
    const token = loginRes.body.token;
    const res = await http("GET", "/api/employees", { token });
    assert.equal(res.status, 200);
  });

  test("finance officer can access finance endpoints", async () => {
    const loginRes = await login(FIN.email, FIN.password);
    const token = loginRes.body.token;
    const res = await http("GET", "/api/finance/charges", { token });
    assert.equal(res.status, 200);
  });

  test("anonymous users cannot access programmes", async () => {
    const res = await http("GET", "/api/programmes");
    assert.equal(res.status, 401);
  });
});
