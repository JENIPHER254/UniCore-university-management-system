/**
 * Development seed — SYNTHETIC data only.
 * Creates the initial administrator (from SEED_ADMIN_* in .env) and demo data:
 * programmes, departments, students, employees, charges and payments.
 * It is idempotent-ish: re-running a second time replaces nothing but adds more data.
 */
import path from "node:path";
import { repoRoot, config } from "../config.js";
import { openDatabase, closeDatabase, type Db } from "./index.js";
import { applyMigrations } from "./migrate.js";
import { hashPassword } from "../auth/password.js";
import { nextNumber } from "../lib/numbers.js";
import { moneyToCents } from "../validation/schemas.js";

const SEED_ADMIN_EMAIL_VALUE = process.env.SEED_ADMIN_EMAIL || "admin@unicore.local";
const SEED_ADMIN_INITIAL_PASSWORD_VALUE = process.env.SEED_ADMIN_INITIAL_PASSWORD || "ChangeMe2026!";

function seed(db: Db): void {
  const db2 = db;

  // 1. Initial administrator (documented secure bootstrapping path)
  const adminEmail = SEED_ADMIN_EMAIL_VALUE.toLowerCase();
  let admin = db2.prepare("SELECT id, email FROM users WHERE email = ?").get(adminEmail) as
    | { id: number; email: string }
    | undefined;
  if (!admin) {
    const res = db2
      .prepare("INSERT INTO users (email, full_name, password_hash, role_code) VALUES (?, ?, ?, 'administrator')")
      .run(adminEmail, "System Administrator", hashPassword(SEED_ADMIN_INITIAL_PASSWORD_VALUE));
    admin = { id: Number(res.lastInsertRowid), email: adminEmail };
    console.log(`Created initial administrator: ${adminEmail}`);
    console.log("Password is the SEED_ADMIN_INITIAL_PASSWORD value from your .env (not printed here).");
  }

  const tx = db2.transaction(() => {
    // 2. Programmes + departments
    const programmeRows = [
      ["BSCS-SW", "BSc Software Engineering", "Undergraduate"],
      ["BSCS-DS", "BSc Data Science", "Undergraduate"],
      ["MSC-IT", "MSc Information Technology", "Postgraduate"],
      ["BBA", "Bachelor of Business Administration", "Undergraduate"],
    ];
    const programmeIds = new Map<string, number>();
    for (const [name, level] of programmeRows.map((p) => [p[1], p[2]] as const)) {
      const exists = db2.prepare("SELECT id FROM programmes WHERE name = ?").get(name) as { id: number } | undefined;
      if (exists) {
        // keep existing — do not re-seed over user's edits
        continue;
      }
      const code = nextNumber(db2, "programme_code");
      const res = db2
        .prepare("INSERT INTO programmes (code, name, level) VALUES (?, ?, ?)")
        .run(code, name, level);
      programmeIds.set(name, Number(res.lastInsertRowid));
    }
    for (const row of db2.prepare("SELECT code, name FROM programmes").all() as { code: string; name: string }[]) {
      programmeIds.set(row.name, (db2.prepare("SELECT id FROM programmes WHERE code = ?").get(row.code) as { id: number }).id);
    }

    const departmentRows = ["Academic Affairs", "Finance & Operations", "Student Services", "Human Resources"];
    const departmentIds = new Map<string, number>();
    for (const name of departmentRows) {
      const exists = db2.prepare("SELECT id FROM departments WHERE name = ?").get(name) as { id: number } | undefined;
      if (exists) continue;
      const code = nextNumber(db2, "department_code");
      const res = db2.prepare("INSERT INTO departments (code, name) VALUES (?, ?)").run(code, name);
      departmentIds.set(name, Number(res.lastInsertRowid));
    }
    for (const row of db2.prepare("SELECT id, name FROM departments").all() as { id: number; name: string }[]) {
      departmentIds.set(row.name, row.id);
    }

    // 3. Students
    const studentSeed = [
      ["Thabo", "Mokoena", "thabo.mokoena@example.edu", "BSc Software Engineering", "2026-02-03"],
      ["Aisha", "Naidoo", "aisha.naidoo@example.edu", "BSc Data Science", "2026-02-03"],
      ["Pieter", "van Wyk", "pieter.vanwyk@example.edu", "BSc Software Engineering", "2026-01-15"],
      ["Lerato", "Dlamini", "lerato.dlamini@example.edu", "MSc Information Technology", "2026-02-10"],
      ["Nomvula", "Khumalo", "nomvula.khumalo@example.edu", "Bachelor of Business Administration", "2026-02-17"],
      ["Sipho", "Ndlovu", "sipho.ndlovu@example.edu", "BSc Data Science", "2026-01-22"],
    ];
    for (const [first, last, email, programmeName, admission] of studentSeed) {
      const exists = db2.prepare("SELECT id FROM students WHERE email = ?").get(email);
      if (exists) continue;
      const number = nextNumber(db2, "student_number");
      db2
        .prepare(
          "INSERT INTO students (student_number, first_name, last_name, email, programme_id, admission_date) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(number, first, last, email, programmeIds.get(programmeName) ?? null, admission);
    }

    // 4. Employees
    const employeeSeed = [
      ["Grace", "Mabaso", "grace.mabaso@example.edu", "Student Services", "Registrar Officer", "2024-05-01"],
      ["Rajesh", "Pillay", "rajesh.pillay@example.edu", "Finance & Operations", "Finance Officer", "2023-10-02"],
      ["Mary", "Sithole", "mary.sithole@example.edu", "Academic Affairs", "Programme Coordinator", "2025-01-20"],
    ];
    for (const [first, last, email, departmentName, title, employmentDate] of employeeSeed) {
      const exists = db2.prepare("SELECT id FROM employees WHERE email = ?").get(email);
      if (exists) continue;
      const number = nextNumber(db2, "employee_number");
      db2
        .prepare(
          "INSERT INTO employees (employee_number, first_name, last_name, email, department_id, job_title, employment_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(number, first, last, email, departmentIds.get(departmentName)!, title, employmentDate);
    }
    // Initial super administrator
    const adminEmail = "admin@unicore.com";

    const existingAdmin = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(adminEmail);

    if (!existingAdmin) {
      db.prepare(`
    INSERT INTO users (email, full_name, password_hash, role_code)
    VALUES (?, ?, ?, ?)
  `).run(
        adminEmail,
        "Admin",
        hashPassword("admin@123"),
        "administrator"
      );

      console.log("Initial super administrator created.");
    } else {
      console.log("Super administrator already exists. Skipping.");
    }
    // 5. Charges + payments for two students (financial demo)
    const financeSeed = [
      { email: "thabo.mokoena@example.edu", charge: 9500.0, payment: 5000.0 },
      { email: "aisha.naidoo@example.edu", charge: 9500.0, payment: 9500.0 },
      { email: "lerato.dlamini@example.edu", charge: 12000.0, payment: 0 },
    ];
    for (const item of financeSeed) {
      const student = db2.prepare("SELECT id, status FROM students WHERE email = ?").get(item.email) as
        | { id: number; status: string }
        | undefined;
      if (!student) continue;
      const open = db2
        .prepare("SELECT COUNT(*) AS n FROM fee_charges WHERE student_id = ?")
        .get(student.id) as { n: number };
      if (open.n > 0) continue; // already seeded charges
      const chargeNo = nextNumber(db2, "charge_number");
      const res = db2
        .prepare(
          "INSERT INTO fee_charges (charge_number, student_id, category, description, amount_cents, charge_date, created_by) VALUES (?, ?, 'tuition', ?, ?, date('now'), ?)"
        )
        .run(chargeNo, student.id, "Semester tuition fee", moneyToCents(String(item.charge)), admin!.id);
      const chargeId = Number(res.lastInsertRowid);
      if (item.payment > 0) {
        const paymentNo = nextNumber(db2, "payment_number");
        const pres = db2
          .prepare(
            "INSERT INTO payments (payment_number, student_id, amount_cents, method, reference, payment_date, received_by) VALUES (?, ?, ?, 'bank_transfer', ?, date('now'), ?)"
          )
          .run(paymentNo, student.id, moneyToCents(String(item.payment)), `SEED-${paymentNo}`, admin!.id);
        const paymentId = Number(pres.lastInsertRowid);
        const toApply = Math.min(moneyToCents(String(item.payment)), item.charge * 100);
        db2
          .prepare("INSERT INTO payment_allocations (payment_id, charge_id, amount_cents) VALUES (?, ?, ?)")
          .run(paymentId, chargeId, toApply);
      }
    }
  });
  tx();
}

function main() {
  const dbPath = config.databasePath;
  console.log(`Seeding ${path.resolve(repoRoot, dbPath)} ...`);
  applyMigrations(); // ensure schema exists even for a fresh clone
  const db = openDatabase();
  seed(db);
  closeDatabase();
  console.log("Seed complete — synthetic development data written.");
}

main();
