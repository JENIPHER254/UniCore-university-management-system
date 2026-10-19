import type { z } from "zod";
import { getDb, nowIso, withTransaction } from "../db/index.js";
import { nextNumber } from "../lib/numbers.js";
import { writeAudit } from "../lib/audit.js";
import { conflict, notFound } from "../lib/errors.js";
import type { employeeSchema, employeeUpdateSchema } from "../validation/schemas.js";
import type { Db } from "../db/index.js";

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof employeeUpdateSchema>;

export interface EmployeeListQuery {
  q?: string;
  departmentId?: number;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
}

const SELECT = `
  e.id, e.employee_number AS employeeNumber, e.first_name AS firstName, e.last_name AS lastName,
  e.email, e.phone, e.department_id AS departmentId, d.name AS departmentName, d.code AS departmentCode,
  e.job_title AS jobTitle, e.employment_date AS employmentDate, e.status, e.created_at AS createdAt`;

export function listEmployees(q: EmployeeListQuery) {
  const db = getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.q) {
    const like = (v: string) => `%${v}%`;
    where.push("(e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_number LIKE ?)");
    params.push(like(q.q), like(q.q), like(q.q), like(q.q));
  }
  if (q.departmentId !== undefined) {
    where.push("e.department_id = ?");
    params.push(q.departmentId);
  }
  if (q.status) {
    where.push("e.status = ?");
    params.push(q.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM employees e ${whereSql}`).get(...params) as { n: number }).n;
  const data = db
    .prepare(
      `SELECT ${SELECT} FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       ${whereSql} ORDER BY e.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getEmployee(id: number) {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${SELECT} FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.id = ?`)
    .get(id);
  if (!row) throw notFound("Employee not found");
  return row;
}

function assertDepartment(db: Db, departmentId: number) {
  const dep = db.prepare("SELECT id FROM departments WHERE id = ?").get(departmentId);
  if (!dep) throw conflict("Selected department does not exist", { departmentId: "Unknown department" });
}

function assertEmailFree(db: Db, email: string, exceptId?: number) {
  const row = exceptId
    ? db.prepare("SELECT id FROM employees WHERE email = ? AND id != ?").get(email, exceptId)
    : db.prepare("SELECT id FROM employees WHERE email = ?").get(email);
  if (row) throw conflict("Email is already used by another employee", { email: "Already in use" });
}

export function createEmployee(input: EmployeeInput, actorId: number, manualNumber?: string) {
  const db = getDb();
  return withTransaction(db, () => {
    assertDepartment(db, input.departmentId);
    assertEmailFree(db, input.email);
    const number = manualNumber ?? nextNumber(db, "employee_number");
    const res = db
      .prepare(
        `INSERT INTO employees (employee_number, first_name, last_name, email, phone, department_id, job_title, employment_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        number,
        input.firstName,
        input.lastName,
        input.email,
        input.phone,
        input.departmentId,
        input.jobTitle,
        input.employmentDate,
        input.status
      );
    writeAudit(db, {
      userId: actorId,
      action: "employee.created",
      entityType: "employee",
      entityId: res.lastInsertRowid,
      details: { employeeNumber: number },
    });
    return getEmployee(Number(res.lastInsertRowid));
  });
}

export function updateEmployee(id: number, input: UpdateEmployeeInput, actorId: number) {
  const db = getDb();
  return withTransaction(db, () => {
    const current = db.prepare("SELECT id FROM employees WHERE id = ?").get(id);
    if (!current) throw notFound("Employee not found");
    assertDepartment(db, input.departmentId);
    assertEmailFree(db, input.email, id);
    db.prepare(
      `UPDATE employees SET first_name=?, last_name=?, email=?, phone=?, department_id=?, job_title=?, employment_date=?, status=?, updated_at=? WHERE id=?`
    ).run(
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.departmentId,
      input.jobTitle,
      input.employmentDate,
      input.status,
      nowIso(),
      id
    );
    writeAudit(db, {
      userId: actorId,
      action: "employee.updated",
      entityType: "employee",
      entityId: id,
      details: { status: input.status },
    });
    return getEmployee(id);
  });
}

export function setEmployeeStatus(id: number, status: "active" | "inactive", actorId: number) {
  const db = getDb();
  const current = db.prepare("SELECT id, status FROM employees WHERE id = ?").get(id) as
    | { id: number; status: string }
    | undefined;
  if (!current) throw notFound("Employee not found");
  if (current.status === status) return getEmployee(id);
  db.prepare("UPDATE employees SET status=?, updated_at=? WHERE id=?").run(status, nowIso(), id);
  writeAudit(db, {
    userId: actorId,
    action: status === "inactive" ? "employee.deactivated" : "employee.reactivated",
    entityType: "employee",
    entityId: id,
  });
  return getEmployee(id);
}

