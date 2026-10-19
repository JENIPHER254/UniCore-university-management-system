import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, closeServer, http, login } from "./http.js";
import { setupTestDatabase, makeUser } from "./helpers.js";
import type { Database } from "better-sqlite3";

let db: Database;
let adminToken = "";
let finToken = "";
let hrToken = "";
let newUserId = 0;
const ADMIN = { email: "admin-u@test.local", password: "Passw0rd123" };
const FIN = { email: "fin-u@test.local", password: "Passw0rd456" };
const HR = { email: "hr-u@test.local", password: "Passw0rd789" };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-perm-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  db = setupTestDatabase(process.env.DATABASE_PATH);
  makeUser(db, ADMIN.email, "Admin Tester", "administrator", ADMIN.password);
  makeUser(db, FIN.email, "Finance Tester", "finance_officer", FIN.password);
  makeUser(db, HR.email, "HR Tester", "hr_officer", HR.password);
  await startServer();
  adminToken = (await login(ADMIN.email, ADMIN.password)).body.token;
  finToken = (await login(FIN.email, FIN.password)).body.token;
  hrToken = (await login(HR.email, HR.password)).body.token;
});

after(async () => {
  await closeServer();
});

describe("user management", () => {
  test("administrator can create a user and persists hashed password", async () => {
    const res = await http("POST", "/api/users", {
      token: adminToken,
      json: { fullName: "New HR", email: "new-hr@test.local", password: "Passw0rd999", roleCode: "hr_officer" },
    });
    assert.equal(res.status, 201);
    const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get("new-hr@test.local") as { password_hash: string };
    assert.ok(row.password_hash.startsWith("$2")); // bcrypt hash, not plaintext
    newUserId = row ? (db.prepare("SELECT id FROM users WHERE email = ?").get("new-hr@test.local") as { id: number }).id : 0;
  });

  test("non-admin users cannot manage users", async () => {
    const res = await http("GET", "/api/users", { token: finToken });
    assert.equal(res.status, 403);
  });

  test("administrator can reset a user's password and role", async () => {
    const res = await http("PUT", `/api/users/${newUserId}`, {
      token: adminToken,
      json: { password: "NewPass123", roleCode: "hr_officer" },
    });
    assert.equal(res.status, 200);
    const loginRes = await login("new-hr@test.local", "NewPass123");
    assert.equal(loginRes.status, 200);
  });

  test("administrator cannot deactivate their own account", async () => {
    const meRes = await http("GET", "/api/auth/me", { token: adminToken });
    const res = await http("PUT", `/api/users/${meRes.body.id}`, {
      token: adminToken,
      json: { isActive: false },
    });
    assert.equal(res.status, 400);
  });

  test("user can change their own password", async () => {
    const res = await http("POST", "/api/auth/change-password", {
      token: hrToken,
      json: { currentPassword: HR.password, newPassword: "FreshPass1" },
    });
    assert.equal(res.status, 200);
    const reLogin = await login(HR.email, "FreshPass1");
    assert.equal(reLogin.status, 200);
  });
});
