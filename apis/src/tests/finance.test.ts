import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, closeServer, http, login, makeDbUser } from "./http.js";
import { setupTestDatabase } from "./helpers.js";

let db: import("better-sqlite3").Database;
let adminToken = "";
let finToken = "";
let otherToken = "";
const ADMIN = { email: "admin-f@test.local", password: "Passw0rd123" };
const FIN = { email: "fin-f@test.local", password: "Passw0rd456" };
const AFF = { email: "aff-f@test.local", password: "Passw0rd789" };

let progId = 0;
let studentA = 0;
let studentB = 0;
let studentInactive = 0;

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-fin-"));
  process.env.DATABASE_PATH = path.join(tmp, "test.db");
  db = setupTestDatabase(process.env.DATABASE_PATH);
  makeDbUser(db, ADMIN.email, "Admin", "administrator", ADMIN.password);
  makeDbUser(db, FIN.email, "Fin", "finance_officer", FIN.password);
  makeDbUser(db, AFF.email, "Affairs", "student_affairs_officer", AFF.password);
  await startServer();
  adminToken = (await login(ADMIN.email, ADMIN.password)).body.token;
  finToken = (await login(FIN.email, FIN.password)).body.token;
  otherToken = (await login(AFF.email, AFF.password)).body.token;

  const prog = await http("POST", "/api/programmes", { token: adminToken, json: { code: "FINP", name: "Finance Programme" } });
  progId = prog.body.id;
  const mk = async (email: string, inactive = false) => {
    const res = await http("POST", "/api/students", {
      token: adminToken,
      json: {
        firstName: "Test",
        lastName: email.split("@")[0],
        email,
        programmeId: progId,
        admissionDate: "2026-02-01",
      },
    });
    const id = res.body.id;
    if (inactive) {
      await http("PATCH", `/api/students/${id}/status`, { token: adminToken, json: { status: "inactive" } });
    }
    return id;
  };
  studentA = await mk("a-f@test.local");
  studentB = await mk("b-f@test.local");
  studentInactive = await mk("inactive-f@test.local", true);
  await startServer();
});

after(async () => {
  await closeServer();
});

describe("charges", () => {
  test("a fee charge is created with a unique charge number and integer cents", async () => {
    const res = await http("POST", "/api/finance/charges", {
      token: finToken,
      json: { studentId: studentA, description: "Tuition", amount: "1000.10", chargeDate: "2026-03-01" },
    });
    assert.equal(res.status, 201);
    assert.match(res.body.charge_number, /^CHR-\d{5}$/);
    assert.equal(res.body.amount_cents, 100010);
  });

  test("student_affairs_officer cannot create charges", async () => {
    const res = await http("POST", "/api/finance/charges", {
      token: otherToken,
      json: { studentId: studentA, description: "Nope", amount: "10.00", chargeDate: "2026-03-01" },
    });
    assert.equal(res.status, 403);
  });

  test("charges for inactive students are rejected", async () => {
    const res = await http("POST", "/api/finance/charges", {
      token: finToken,
      json: { studentId: studentInactive, description: "No", amount: "10.00", chargeDate: "2026-03-01" },
    });
    assert.equal(res.status, 400);
  });

  test("invalid money strings are rejected", async () => {
    const res = await http("POST", "/api/finance/charges", {
      token: finToken,
      json: { studentId: studentA, description: "Bad", amount: "10.005", chargeDate: "2026-03-01" },
    });
    assert.equal(res.status, 400);
  });
});

describe("payments", () => {
  test("payment auto-allocates FIFO and balances work out", async () => {
    // studentB: two charges 500.00 then 300.00; pay 650.00
    await http("POST", "/api/finance/charges", {
      token: adminToken,
      json: { studentId: studentB, description: "Charge C1", amount: "500.00", chargeDate: "2026-01-01" },
    });
    await http("POST", "/api/finance/charges", {
      token: adminToken,
      json: { studentId: studentB, description: "Charge C2", amount: "300.00", chargeDate: "2026-02-01" },
    });
    const pay = await http("POST", "/api/finance/payments", {
      token: finToken,
      json: { studentId: studentB, amount: "650.00", paymentDate: "2026-03-05" },
    });
    assert.equal(pay.status, 201);
    assert.match(pay.body.payment_number, /^PMT-\d{5}$/);

    const profile = await http("GET", `/api/finance/students/${studentB}/profile`, { token: finToken });
    const charges = profile.body.charges;
    assert.equal(charges[0].openCents, 0); // 500 - 500
    assert.equal(charges[1].openCents, 15000); // 300 - 150
    assert.equal(profile.body.totals.outstandingCents, 15000);
    assert.equal(profile.body.totals.paymentsCents, 65000);
    assert.equal(profile.body.totals.chargesCents, 80000);
  });

  test("over-allocation is rejected", async () => {
    const res = await http("POST", "/api/finance/payments", {
      token: finToken,
      json: {
        studentId: studentB,
        amount: "100.00",
        paymentDate: "2026-03-06",
        allocations: [{ chargeId: 999999, amount: "100.00" }],
      },
    });
    assert.equal(res.status, 400);
  });

  test("explicit allocations cannot exceed charge open amount", async () => {
    const charges = await http("GET", `/api/finance/charges?studentId=${studentB}`, { token: finToken });
    const c2 = charges.body.data.find((c: any) => c.description === "Charge C2"); // open 150.00
    const res = await http("POST", "/api/finance/payments", {
      token: finToken,
      json: {
        studentId: studentB,
        amount: "200.00",
        paymentDate: "2026-03-07",
        allocations: [{ chargeId: c2.id, amount: "200.00" }],
      },
    });
    assert.equal(res.status, 400);
  });

  test("controlled reversal flags the payment and rebalances without deleting", async () => {
    const payments = await http("GET", `/api/finance/payments?studentId=${studentB}`, { token: finToken });
    const payment = payments.body.data[0];
    const reversed = await http("POST", `/api/finance/payments/${payment.id}/reverse`, {
      token: finToken,
      json: { reason: "Duplicate capture" },
    });
    assert.equal(reversed.status, 200);
    assert.equal(reversed.body.is_reversed, 1);

    const profile = await http("GET", `/api/finance/students/${studentB}/profile`, { token: finToken });
    assert.equal(profile.body.totals.paymentsCents, 0);
    assert.equal(profile.body.totals.outstandingCents, 80000);

    const inDb = db.prepare("SELECT COUNT(*) AS n FROM payments WHERE id = ?").get(payment.id) as { n: number };
    assert.equal(inDb.n, 1);

    const again = await http("POST", `/api/finance/payments/${payment.id}/reverse`, {
      token: finToken,
      json: { reason: "Double reversal attempt" },
    });
    assert.equal(again.status, 409);
  });

  test("reversal requires a reason", async () => {
    await http("POST", "/api/finance/charges", {
      token: finToken,
      json: { studentId: studentA, description: "Charge T2", amount: "10.00", chargeDate: "2026-03-02" },
    });
    await http("POST", "/api/finance/payments", {
      token: finToken,
      json: { studentId: studentA, amount: "10.00", paymentDate: "2026-03-03" },
    });
    const payments = await http("GET", `/api/finance/payments?studentId=${studentA}`, { token: finToken });
    const payment = payments.body.data[0];
    const res = await http("POST", `/api/finance/payments/${payment.id}/reverse`, { token: finToken, json: { reason: "no" } });
    assert.equal(res.status, 400);
  });

  test("payments for inactive students are rejected", async () => {
    const res = await http("POST", "/api/finance/payments", {
      token: finToken,
      json: { studentId: studentInactive, amount: "10.00", paymentDate: "2026-03-03" },
    });
    assert.equal(res.status, 400);
  });
});
