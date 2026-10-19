import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, closeServer, http, login, makeDbUser } from "./http.js";
import { setupTestDatabase } from "./helpers.js";
import { importCsv, type ImportEntity } from "../services/import.service.js";

let db: import("better-sqlite3").Database;
let token = "";
const ADMIN = { email: "admin-i@test.local", password: "Passw0rd123" };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-imp-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  db = setupTestDatabase(process.env.DATABASE_PATH);
  makeDbUser(db, ADMIN.email, "Admin", "administrator", ADMIN.password);
  await startServer();
  token = (await login(ADMIN.email, ADMIN.password)).body.token;
});

after(async () => {
  await closeServer();
});

describe("csv import", () => {
  test("programmes: dry run writes nothing, real import writes rows", async () => {
    const csv = "code,name,level,isActive\nPG1,Test Programme One,UG,true\nPG2,Test Programme Two,PG,false\n";
    const dry = await http("POST", "/api/import/programmes", { token, json: { csv, dryRun: true } });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.successful, 2);
    const countDry = (db.prepare("SELECT COUNT(*) AS n FROM programmes WHERE code = 'PG1'").get() as { n: number }).n;
    assert.equal(countDry, 0);

    const real = await http("POST", "/api/import/programmes", { token, json: { csv, dryRun: false } });
    assert.equal(real.status, 200);
    assert.equal(real.body.successful, 2);
    const countReal = (db.prepare("SELECT COUNT(*) AS n FROM programmes WHERE code = 'PG2'").get() as { n: number }).n;
    assert.equal(countReal, 1);
  });

  test("in-file duplicates are skipped with an explanation", async () => {
    const csv = "code,name,isActive\nDP1,Dept One,true\nDP1,Dept One Copy,true\n";
    const res = await http("POST", "/api/import/departments", { token, json: { csv, dryRun: false } });
    assert.equal(res.body.successful, 1);
    assert.equal(res.body.skipped, 1);
    assert.equal(res.body.rows[1].errors.code, "Duplicate code in file");
  });

  test("invalid references and bad fields are rejected row-by-row with field errors", async () => {
    const csv =
      "studentNumber,firstName,lastName,email,phone,programmeCode,admissionDate,status\n" +
      "STU-90001,Thabo,Mokoena,thabo.i@test.local,,BADPROG,2026-02-03,active\n" +
      "STU-90002,Aisha,Naidoo,not-an-email,,PG2,2026-02-03,active\n";
    const res = await http("POST", "/api/import/students", { token, json: { csv, dryRun: false } });
    assert.equal(res.body.successful, 0);
    assert.equal(res.body.rejected, 2);
    assert.equal(res.body.rows[0].errors.programmeCode, "Programme 'BADPROG' not found");
    assert.equal(res.body.rows[1].errors.email, "Invalid email format");
  });

  test("students import auto-allocates numbers and imports charges safely", async () => {
    const progs = await http("GET", "/api/programmes", { token });
    const code = progs.body.rows?.[0]?.code ?? (await http("GET", "/api/programmes", { token })).body[0].code;
    const studentCsv = `studentNumber,firstName,lastName,email,phone,programmeCode,admissionDate,status\n,Neo,Tau,neo.i@test.local,,${code},2026-01-10,active\n`;
    const res = await http("POST", "/api/import/students", { token, json: { csv: studentCsv, dryRun: false } });
    assert.equal(res.body.successful, 1);
    const student = db.prepare("SELECT * FROM students WHERE email = ?").get("neo.i@test.local") as any;
    assert.match(student.student_number, /^STU-\d{5}$/);

    const chargeCsv = `studentNumber,category,description,amount,chargeDate\n${student.student_number},tuition,Import charge,150.00,2026-01-20\n`;
    const chargeRes = await http("POST", "/api/import/fee_charges", { token, json: { csv: chargeCsv, dryRun: false } });
    assert.equal(chargeRes.body.successful, 1);
    const chargeCount = (
      db.prepare("SELECT COUNT(*) AS n FROM fee_charges WHERE student_id = ?").get(student.id) as { n: number }
    ).n;
    assert.equal(chargeCount, 1);
  });

  test("missing required columns fail fast with a useful message", async () => {
    const res = await http("POST", "/api/import/students", { token, json: { csv: "firstName,lastName\nA,B\n", dryRun: false } });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes("programmeCode"));
  });

  test("service-level dry run leaves the database untouched", () => {
    const csv = "code,name,isActive\nDPX,Dry X,true\n";
    const before = (db.prepare("SELECT COUNT(*) AS n FROM departments").get() as { n: number }).n;
    const result = importCsv("departments" as ImportEntity, csv, 1, true);
    assert.equal(result.successful, 1);
    const afterCount = (db.prepare("SELECT COUNT(*) AS n FROM departments").get() as { n: number }).n;
    assert.equal(afterCount, before);
  });
});
