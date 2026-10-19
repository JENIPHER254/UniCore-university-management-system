/**
 * CSV import/export for students, programmes, employees, departments,
 * fee charges and payments.
 *
 * - Validates headers and each row's field formats.
 * - Detects duplicates inside the file and against existing rows.
 * - Runs inside one transaction: any fatal error rolls back the whole batch.
 * - Supports dry-run (validate only, nothing is written).
 * - Produces per-row explanations with counts of successful, rejected, and skipped rows.
 */
import { getDb, withTransaction } from "../db/index.js";
import { parseCsv, rowsToObjects, type CsvRow } from "../lib/csv.js";
import { nextNumber } from "../lib/numbers.js";
import { badRequest } from "../lib/errors.js";
import { moneyToCents } from "../validation/schemas.js";
import * as programmesSrv from "./reference.service.js";
import * as studentsSrv from "./students.service.js";
import * as employeesSrv from "./employees.service.js";
import * as financeSrv from "./finance.service.js";
import { createProgrammeTypeGuard, createDepartmentTypeGuard } from "./import.guards.js";

export type ImportEntity =
  | "students"
  | "programmes"
  | "departments"
  | "employees"
  | "fee_charges"
  | "payments";

interface RowStatus {
  row: number; // 1-based data row number (excluding header)
  status: "imported" | "rejected" | "skipped";
  errors: Record<string, string>;
}

export interface ImportResult {
  entity: ImportEntity;
  dryRun: boolean;
  successful: number;
  rejected: number;
  skipped: number;
  rows: RowStatus[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function moneyError(v: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return "Enter amount as decimal with up to 2 places, e.g. 1250.50";
  if (Math.round(Number(v) * 100) <= 0) return "Amount must be greater than zero";
  return null;
}

export function exportEntity(entity: ImportEntity): { headers: string[]; rows: Record<string, unknown>[] } {
  const db = getDb();
  switch (entity) {
    case "programmes":
      return {
        headers: ["code", "name", "level", "isActive"],
        rows: db.prepare("SELECT code, name, level, is_active AS isActive FROM programmes ORDER BY id").all() as Record<string, unknown>[],
      };
    case "departments":
      return {
        headers: ["code", "name", "isActive"],
        rows: db.prepare("SELECT code, name, is_active AS isActive FROM departments ORDER BY id").all() as Record<string, unknown>[],
      };
    case "students":
      return {
        headers: ["studentNumber", "firstName", "lastName", "email", "phone", "programmeCode", "admissionDate", "status"],
        rows: db
          .prepare(
            `SELECT s.student_number AS studentNumber, s.first_name AS firstName, s.last_name AS lastName,
                    s.email, s.phone, COALESCE(p.code, '') AS programmeCode, s.admission_date AS admissionDate, s.status
             FROM students s LEFT JOIN programmes p ON p.id = s.programme_id ORDER BY s.id`
          )
          .all() as Record<string, unknown>[],
      };
    case "employees":
      return {
        headers: ["employeeNumber", "firstName", "lastName", "email", "phone", "departmentCode", "jobTitle", "employmentDate", "status"],
        rows: db
          .prepare(
            `SELECT e.employee_number AS employeeNumber, e.first_name AS firstName, e.last_name AS lastName,
                    e.email, e.phone, COALESCE(d.code, '') AS departmentCode, e.job_title AS jobTitle,
                    e.employment_date AS employmentDate, e.status
             FROM employees e LEFT JOIN departments d ON d.id = e.department_id ORDER BY e.id`
          )
          .all() as Record<string, unknown>[],
      };
    case "fee_charges":
      return {
        headers: ["chargeNumber", "studentNumber", "category", "description", "amount", "chargeDate"],
        rows: db
          .prepare(
            `SELECT c.charge_number AS chargeNumber, s.student_number AS studentNumber, c.category,
                    c.description, (c.amount_cents / 100.0) AS amount, c.charge_date AS chargeDate
             FROM fee_charges c JOIN students s ON s.id = c.student_id ORDER BY c.id`
          )
          .all() as Record<string, unknown>[],
      };
    case "payments":
      return {
        headers: ["paymentNumber", "studentNumber", "amount", "method", "reference", "note", "paymentDate", "isReversed"],
        rows: db
          .prepare(
            `SELECT p.payment_number AS paymentNumber, s.student_number AS studentNumber,
                    (p.amount_cents / 100.0) AS amount, p.method, p.reference, p.note,
                    p.payment_date AS paymentDate, p.is_reversed AS isReversed
             FROM payments p JOIN students s ON s.id = p.student_id ORDER BY p.id`
          )
          .all() as Record<string, unknown>[],
      };
  }
}

// map programme/department code -> id
function idByCode(db: import("better-sqlite3").Database, table: string, code: string): number | null {
  const row = db.prepare(`SELECT id FROM ${table} WHERE code = ?`).get(code) as { id: number } | undefined;
  return row ? row.id : null;
}

export function importCsv(
  entity: ImportEntity,
  fileContent: string,
  actorId: number,
  dryRun: boolean
): ImportResult {
  const rows = parseCsv(fileContent);
  if (rows.length === 0) throw badRequest("The CSV file is empty");
  const objects = rowsToObjects(rows);
  const db = getDb();

  const required: Record<ImportEntity, string[]> = {
    programmes: ["name", "code"],
    departments: ["name", "code"],
    students: ["firstName", "lastName", "email", "programmeCode", "admissionDate"],
    employees: ["firstName", "lastName", "email", "departmentCode", "employmentDate"],
    fee_charges: ["studentNumber", "description", "amount", "chargeDate"],
    payments: ["studentNumber", "amount", "paymentDate"],
  };

  const headers = Object.keys(objects[0] ?? {});
  const missing = required[entity].filter((h) => !headers.includes(h));
  if (missing.length) throw badRequest(`Missing required columns: ${missing.join(", ")}`);

  const seen = new Map<string, number>(); // in-file duplicate detection keyed per entity
  const statuses: RowStatus[] = [];
  let successful = 0;
  let rejected = 0;
  let skipped = 0;

  try {
    withTransaction(db, () => {
      objects.forEach((row, idx) => {
      const rowStatus: RowStatus = { row: idx + 1, status: "imported", errors: {} };
      const errors = rowStatus.errors;
      const num = (v: string) => (v === "" ? undefined : Number(v));
      const b = (v: string) => v.toLowerCase() === "true" || v === "1";

      try {
        switch (entity) {
          case "programmes": {
            if (!row.code) errors.code = "Code is required";
            else {
              const key = `p:${row.code.toLowerCase()}`;
              if (seen.has(key)) errors.code = "Duplicate code in file";
              else if (idByCode(db, "programmes", row.code)) errors.code = "Code already exists";
              seen.set(key, idx);
            }
            if (!row.name || row.name.trim().length < 2) errors.name = "Name is required";
            if (Object.keys(errors).length) break;
            const programme = createProgrammeTypeGuard({
              code: row.code,
              name: row.name,
              level: row.level ?? "",
              isActive: row.isActive ? b(row.isActive) : true,
            });
            programmesSrv.createProgramme(programme, actorId, row.code);
            if (dryRun) db.prepare("DELETE FROM programmes WHERE id = last_insert_rowid()").run();
            break;
          }
          case "departments": {
            if (!row.code) errors.code = "Code is required";
            else {
              const key = `d:${row.code.toLowerCase()}`;
              if (seen.has(key)) errors.code = "Duplicate code in file";
              else if (idByCode(db, "departments", row.code)) errors.code = "Code already exists";
              seen.set(key, idx);
            }
            if (!row.name || row.name.trim().length < 2) errors.name = "Name is required";
            if (Object.keys(errors).length) break;
            const department = createDepartmentTypeGuard({
              code: row.code,
              name: row.name,
              isActive: row.isActive ? b(row.isActive) : true,
            });
            programmesSrv.createDepartment(department, actorId, row.code);
            if (dryRun) db.prepare("DELETE FROM departments WHERE id = last_insert_rowid()").run();
            break;
          }
          case "students": {
            if (!row.firstName) errors.firstName = "First name is required";
            if (!row.lastName) errors.lastName = "Last name is required";
            if (!row.email) errors.email = "Email is required";
            else if (!EMAIL_RE.test(row.email)) errors.email = "Invalid email format";
            else {
              const key = `se:${row.email.toLowerCase()}`;
              if (seen.has(key)) errors.email = "Duplicate email in file";
              else if (db.prepare("SELECT id FROM students WHERE email = ?").get(row.email)) errors.email = "Email already exists";
              seen.set(key, idx);
            }
            const programmeId = row.programmeCode ? idByCode(db, "programmes", row.programmeCode) : null;
            if (!programmeId) errors.programmeCode = `Programme '${row.programmeCode ?? ""}' not found`;
            if (!row.admissionDate || !isDate(row.admissionDate)) errors.admissionDate = "Date required as YYYY-MM-DD";
            if (row.status && !["active", "inactive"].includes(row.status)) errors.status = "Must be 'active' or 'inactive'";
            let studentNumber: string | undefined;
            if (row.studentNumber) {
              const key = `st:${row.studentNumber}`;
              if (seen.has(key)) errors.studentNumber = "Duplicate student number in file";
              else if (db.prepare("SELECT id FROM students WHERE student_number = ?").get(row.studentNumber))
                errors.studentNumber = "Student number already exists";
              seen.set(key, idx);
              studentNumber = row.studentNumber;
            }
            if (Object.keys(errors).length) break;
            studentsSrv.createStudent(
              {
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.phone ?? "",
                programmeId: programmeId as number,
                admissionDate: row.admissionDate,
                status: row.status === "inactive" ? "inactive" : "active",
              },
              actorId,
              studentNumber
            );
            if (dryRun) {
              // Remove the row again — nothing should persist on a dry run.
              db.prepare("DELETE FROM students WHERE id = last_insert_rowid()").run();
            }
            break;
          }
          case "employees": {
            if (!row.firstName) errors.firstName = "First name is required";
            if (!row.lastName) errors.lastName = "Last name is required";
            if (!row.email) errors.email = "Email is required";
            else if (!EMAIL_RE.test(row.email)) errors.email = "Invalid email format";
            else {
              const key = `ee:${row.email.toLowerCase()}`;
              if (seen.has(key)) errors.email = "Duplicate email in file";
              else if (db.prepare("SELECT id FROM employees WHERE email = ?").get(row.email)) errors.email = "Email already exists";
              seen.set(key, idx);
            }
            const departmentId = row.departmentCode ? idByCode(db, "departments", row.departmentCode) : null;
            if (!departmentId) errors.departmentCode = `Department '${row.departmentCode ?? ""}' not found`;
            if (!row.employmentDate || !isDate(row.employmentDate)) errors.employmentDate = "Date required as YYYY-MM-DD";
            if (row.status && !["active", "inactive"].includes(row.status)) errors.status = "Must be 'active' or 'inactive'";
            if (Object.keys(errors).length) break;
            let employeeNumber: string | undefined;
            if (row.employeeNumber) {
              const key = `emp:${row.employeeNumber}`;
              if (seen.has(key)) errors.employeeNumber = "Duplicate employee number in file";
              else if (db.prepare("SELECT id FROM employees WHERE employee_number = ?").get(row.employeeNumber))
                errors.employeeNumber = "Employee number already exists";
              seen.set(key, idx);
              employeeNumber = row.employeeNumber;
            }
            employeesSrv.createEmployee(
              {
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.phone ?? "",
                departmentId: departmentId as number,
                jobTitle: row.jobTitle ?? "",
                employmentDate: row.employmentDate,
                status: row.status === "inactive" ? "inactive" : "active",
              },
              actorId,
              employeeNumber
            );
            if (dryRun) db.prepare("DELETE FROM employees WHERE id = last_insert_rowid()").run();
            break;
          }
          case "fee_charges": {
            const studentId = row.studentNumber
              ? (db.prepare("SELECT id, status FROM students WHERE student_number = ?").get(row.studentNumber) as
                  | { id: number; status: string }
                  | undefined)
              : undefined;
            if (!studentId) errors.studentNumber = `Student '${row.studentNumber ?? ""}' not found`;
            const moneyErr = row.amount ? moneyError(row.amount) : "Amount is required";
            if (moneyErr) errors.amount = moneyErr;
            if (!row.description || row.description.trim().length < 3) errors.description = "Description is required";
            if (!row.chargeDate || !isDate(row.chargeDate)) errors.chargeDate = "Date required as YYYY-MM-DD";
            if (studentId && studentId.status !== "active") errors.studentNumber = "Student is inactive";
            if (Object.keys(errors).length) break;
            const charge = financeSrv.createCharge(
              {
                studentId: studentId!.id,
                category: (["tuition", "accommodation", "library", "registration", "other"].includes(row.category ?? "")
                  ? row.category
                  : "other") as "other" | "library" | "accommodation" | "registration" | "tuition",
                description: row.description,
                amount: row.amount,
                chargeDate: row.chargeDate,
              },
              actorId
            );
            if (dryRun) {
              db.prepare("DELETE FROM payment_allocations WHERE charge_id = ?").run((charge as { id: number }).id);
              db.prepare("DELETE FROM fee_charges WHERE id = ?").run((charge as { id: number }).id);
            }
            break;
          }
          case "payments": {
            const studentId = row.studentNumber
              ? (db.prepare("SELECT id, status FROM students WHERE student_number = ?").get(row.studentNumber) as
                  | { id: number; status: string }
                  | undefined)
              : undefined;
            if (!studentId) errors.studentNumber = `Student '${row.studentNumber ?? ""}' not found`;
            const moneyErr = row.amount ? moneyError(row.amount) : "Amount is required";
            if (moneyErr) errors.amount = moneyErr;
            if (!row.paymentDate || !isDate(row.paymentDate)) errors.paymentDate = "Date required as YYYY-MM-DD";
            if (row.isReversed && row.isReversed !== "0")
              errors.isReversed = "Imported payments must be unreversed — reverse through the app";
            if (Object.keys(errors).length) break;
            const payment = financeSrv.createPayment(
              {
                studentId: studentId!.id,
                amount: row.amount,
                method: (["cash", "bank_transfer", "card", "mobile_money", "cheque"].includes(row.method ?? "")
                  ? row.method
                  : "cash") as "cash" | "bank_transfer" | "card" | "mobile_money" | "cheque",
                reference: row.reference ?? "",
                note: row.note ?? "",
                paymentDate: row.paymentDate,
              },
              actorId
            );
            if (dryRun) {
              db.prepare("DELETE FROM payment_allocations WHERE payment_id = ?").run((payment as { id: number }).id);
              db.prepare("DELETE FROM payments WHERE id = ?").run((payment as { id: number }).id);
            }
            break;
          }
        }
        if (Object.keys(errors).length === 0) {
          successful += 1;
          statuses.push(rowStatus);
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors._row = errors._row ?? message;
      }
      if (Object.keys(rowStatus.errors).length > 0) {
        // A previously-seen duplicate within the file is 'skipped'; other rows 'rejected'.
        const isDup = Object.values(rowStatus.errors).some((m) => m.startsWith("Duplicate"));
        rowStatus.status = isDup ? "skipped" : "rejected";
        if (isDup) skipped += 1;
        else rejected += 1;
      } else {
        successful += 1;
      }
      statuses.push(rowStatus);
    });
    if (dryRun) throw new ImportRollbackMarker(); // always rollback dry runs
  });
  } catch (err) {
    if (!(err instanceof ImportRollbackMarker)) throw err; // dry-run forced rollback is expected
  }
  return { entity, dryRun, successful, rejected, skipped, rows: statuses };
}

/** Internal marker used to force rollback of dry-run batches. */
export class ImportRollbackMarker extends Error {
  constructor() {
    super("dry-run");
  }
}

export function csvToEntities(entity: ImportEntity, content: string): CsvRow[] {
  return rowsToObjects(parseCsv(content));
}

export function nextNumberFor(db: import("better-sqlite3").Database, key: string): string {
  return nextNumber(db, key);
}
