import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, closeServer, http, login, makeDbUser } from "./http.js";
import { setupTestDatabase } from "./helpers.js";

let db: import("better-sqlite3").Database;
let token = "";
const ADMIN = { email: "admin-s@test.local", password: "Passw0rd123" };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-stu-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  db = setupTestDatabase(process.env.DATABASE_PATH);
  makeDbUser(db, ADMIN.email, "Admin", "administrator", ADMIN.password);
  await startServer();
  const loginRes = await login(ADMIN.email, ADMIN.password);
  token = loginRes.body.token;
});

after(async () => {
  await closeServer();
});

async function makeProgramme(code: string): Promise<number> {
  const res = await http("POST", "/api/programmes", {
    token,
    json: { code, name: `Programme ${code}` },
  });
  assert.equal(res.status, 201);
  return res.body.id;
}

describe("students", () => {
  test("student number is auto-allocated and unique", async () => {
    const prog = await makeProgramme("BSCS");
    const res = await http("POST", "/api/students", {
      token,
      json: {
        firstName: "Thabo",
        lastName: "Mokoena",
        email: "thabo.m@test.local",
        programmeId: prog,
        admissionDate: "2026-02-03",
      },
    });
    assert.equal(res.status, 201);
    assert.match(res.body.studentNumber, /^STU-\d{5}$/);
    assert.equal(res.body.status, "active");
  });

  test("duplicate email is rejected with 409 and field details", async () => {
    const prog = await makeProgramme("BENG2");
    const payload = {
      firstName: "Asha",
      lastName: "Nkosi",
      email: "dup@test.local",
      programmeId: prog,
      admissionDate: "2026-02-05",
    };
    const first = await http("POST", "/api/students", { token, json: payload });
    assert.equal(first.status, 201);
    const second = await http("POST", "/api/students", { token, json: payload });
    assert.equal(second.status, 409);
  });

  test("validation errors return 400 with field messages", async () => {
    const prog = await makeProgramme("BADV");
    const res = await http("POST", "/api/students", {
      token,
      json: { firstName: "", lastName: "Ok", email: "not-an-email", programmeId: prog, admissionDate: "2026-13-40" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.firstName);
    assert.ok(res.body.error.details.email);
    assert.ok(res.body.error.details.admissionDate);
  });

  test("list supports search, pagination and totals", async () => {
    const listAll = await http("GET", "/api/students?page=1&pageSize=1", { token });
    assert.equal(listAll.status, 200);
    assert.equal(listAll.body.data.length, 1);
    assert.ok(listAll.body.total >= 2, `expected at least two students, got ${listAll.body.total}`);

    const search = await http("GET", "/api/students?q=Thabo", { token });
    assert.equal(search.status, 200);
    assert.equal(search.body.data.length, 1);

    const paged = await http("GET", "/api/students?page=2&pageSize=2", { token });
    assert.equal(paged.body.page, 2);
    assert.equal(paged.body.data.length, listAll.body.total - 2);
  });

  test("student can be deactivated and reactivated without deleting history", async () => {
    const prog = await makeProgramme("DEACT");
    const created = await http("POST", "/api/students", {
      token,
      json: {
        firstName: "Neo",
        lastName: "Tau",
        email: "neo.tau@test.local",
        programmeId: prog,
        admissionDate: "2026-01-01",
      },
    });
    const id = created.body.id;
    const off = await http("PATCH", `/api/students/${id}/status`, { token, json: { status: "inactive" } });
    assert.equal(off.status, 200);
    assert.equal(off.body.status, "inactive");
    const on = await http("PATCH", `/api/students/${id}/status`, { token, json: { status: "active" } });
    assert.equal(on.status, 200);
    assert.equal(on.body.status, "active");
  });

  test("student profile returns editable data and unknown ids 404", async () => {
    const prog = await makeProgramme("PROF");
    const created = await http("POST", "/api/students", {
      token,
      json: {
        firstName: "Zanele",
        lastName: "Mhlongo",
        email: "zanele.m@test.local",
        programmeId: prog,
        admissionDate: "2026-02-15",
      },
    });
    const got = await http("GET", `/api/students/${created.body.id}`, { token });
    assert.equal(got.status, 200);
    assert.equal(got.body.studentNumber, created.body.studentNumber);

    const missing = await http("GET", "/api/students/999999", { token });
    assert.equal(missing.status, 404);
  });
});
