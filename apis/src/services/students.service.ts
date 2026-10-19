import { getDb, nowIso, withTransaction } from "../db/index.js";
import { nextNumber } from "../lib/numbers.js";
import { writeAudit } from "../lib/audit.js";
import { conflict, notFound } from "../lib/errors.js";
import type { studentSchema, studentUpdateSchema } from "../validation/schemas.js";
import type { z } from "zod";

export type CreateStudentInput = z.infer<typeof studentSchema>;
export type UpdateStudentInput = z.infer<typeof studentUpdateSchema>;

export interface ListQuery {
  q?: string;
  programmeId?: number;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
}

const STUDENT_SELECT = `
  s.id, s.student_number AS studentNumber, s.first_name AS firstName, s.last_name AS lastName,
  s.email, s.phone, s.programme_id AS programmeId, p.name AS programmeName, p.code AS programmeCode,
  s.admission_date AS admissionDate, s.status, s.created_at AS createdAt`;

/** Account balance (cents) = valid charges - valid (non-reversed) payments. */
const BALANCE_SQL = `
  (SELECT COALESCE(SUM(c.amount_cents), 0) FROM fee_charges c WHERE c.student_id = s.id)
  - (SELECT COALESCE(SUM(p.amount_cents), 0) FROM payments p WHERE p.student_id = s.id AND p.is_reversed = 0)`;

export function listStudents(query: ListQuery) {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.q) {
    where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.student_number LIKE ?)");
    const like = `%${query.q}%`;
    params.push(like, like, like, like);
  }
  if (query.programmeId !== undefined) {
    where.push("s.programme_id = ?");
    params.push(query.programmeId);
  }
  if (query.status) {
    where.push("s.status = ?");
    params.push(query.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM students s ${whereSql}`).get(...params) as { n: number }
  ).n;
  const data = db
    .prepare(
      `SELECT ${STUDENT_SELECT}, ${BALANCE_SQL} AS balanceCents
       FROM students s LEFT JOIN programmes p ON p.id = s.programme_id
       ${whereSql}
       ORDER BY s.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getStudent(id: number) {
  const db = getDb();
  const student = db
    .prepare(
      `SELECT ${STUDENT_SELECT}, ${BALANCE_SQL} AS balanceCents
       FROM students s LEFT JOIN programmes p ON p.id = s.programme_id
       WHERE s.id = ?`
    )
    .get(id);
  if (!student) throw notFound("Student not found");
  return student;
}

/** Full profile: student + charges + payments + totals. */
export function getStudentProfile(id: number) {
  const db = getDb();
  const student = getStudent(id) as { id: number; balanceCents: number };
  const charges = db
    .prepare(
      `SELECT c.id, c.charge_number AS chargeNumber, c.category, c.description, c.amount_cents AS amountCents,
              c.charge_date AS chargeDate,
              COALESCE((SELECT SUM(a.amount_cents) FROM payment_allocations a
                        JOIN payments p2 ON p2.id = a.payment_id
                        WHERE a.charge_id = c.id AND p2.is_reversed = 0), 0) AS allocatedCents
       FROM fee_charges c WHERE c.student_id = ? ORDER BY c.charge_date, c.id`
    )
    .all(id) as { id: number; amountCents: number; allocatedCents: number }[];
  const payments = db
    .prepare(
      `SELECT p.id, p.payment_number AS paymentNumber, p.amount_cents AS amountCents, p.method, p.reference,
              p.note, p.payment_date AS paymentDate, p.is_reversed AS isReversed, p.reversal_reason AS reversalReason,
              p.reversed_at AS reversedAt
       FROM payments p WHERE p.student_id = ? ORDER BY p.payment_date DESC, p.id DESC`
    )
    .all(id) as unknown[];
  const totalsQ = db
    .prepare(
      `SELECT
        COALESCE((SELECT SUM(amount_cents) FROM fee_charges WHERE student_id = ?), 0) AS chargesCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE student_id = ? AND is_reversed = 0), 0) AS paymentsCents`
    )
    .get(id, id) as { chargesCents: number; paymentsCents: number };
  return {
    student,
    charges: charges.map((c: { amountCents: number; allocatedCents: number }) => ({
      ...c,
      openCents: c.amountCents - c.allocatedCents,
    })),
    payments,
    totals: {
      ...totalsQ,
      outstandingCents: totalsQ.chargesCents - totalsQ.paymentsCents,
    },
  };
}

function assertProgramme(db: ReturnType<typeof getDb>, programmeId: number) {
  const p = db.prepare("SELECT id FROM programmes WHERE id = ?").get(programmeId);
  if (!p) throw conflict("Selected programme does not exist", { programmeId: "Unknown programme" });
}

function assertEmailFree(db: ReturnType<typeof getDb>, email: string, exceptId?: number) {
  const row = exceptId
    ? db.prepare("SELECT id FROM students WHERE email = ? AND id != ?").get(email, exceptId)
    : db.prepare("SELECT id FROM students WHERE email = ?").get(email);
  if (row) throw conflict("Email is already used by another student", { email: "Already in use" });
}

export function createStudent(input: CreateStudentInput, actorId: number, manualNumber?: string) {
  const db = getDb();
  return withTransaction(db, () => {
    assertProgramme(db, input.programmeId);
    assertEmailFree(db, input.email);
    const number = manualNumber ?? nextNumber(db, "student_number");
    const result = db
      .prepare(
        `INSERT INTO students (student_number, first_name, last_name, email, phone, programme_id, admission_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        number,
        input.firstName,
        input.lastName,
        input.email,
        input.phone,
        input.programmeId,
        input.admissionDate,
        input.status
      );
    writeAudit(db, {
      userId: actorId,
      action: "student.created",
      entityType: "student",
      entityId: result.lastInsertRowid,
      details: { studentNumber: number, name: `${input.firstName} ${input.lastName}` },
    });
    return getStudent(Number(result.lastInsertRowid));
  });
}

export function updateStudent(id: number, input: UpdateStudentInput, actorId: number) {
  const db = getDb();
  return withTransaction(db, () => {
    const current = db.prepare("SELECT id FROM students WHERE id = ?").get(id);
    if (!current) throw notFound("Student not found");
    assertProgramme(db, input.programmeId);
    assertEmailFree(db, input.email, id);
    db.prepare(
      `UPDATE students SET first_name=?, last_name=?, email=?, phone=?, programme_id=?, admission_date=?, status=?, updated_at=? WHERE id=?`
    ).run(
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.programmeId,
      input.admissionDate,
      input.status,
      nowIso(),
      id
    );
    writeAudit(db, {
      userId: actorId,
      action: "student.updated",
      entityType: "student",
      entityId: id,
      details: { status: input.status },
    });
    return getStudent(id);
  });
}

/** Deactivate/activate without deleting history. */
export function setStudentStatus(id: number, status: "active" | "inactive", actorId: number) {
  const db = getDb();
  const current = db.prepare("SELECT id, status FROM students WHERE id = ?").get(id) as
    | { id: number; status: string }
    | undefined;
  if (!current) throw notFound("Student not found");
  if (current.status === status) return getStudent(id);
  db.prepare("UPDATE students SET status=?, updated_at=? WHERE id=?").run(status, nowIso(), id);
  writeAudit(db, {
    userId: actorId,
    action: status === "inactive" ? "student.deactivated" : "student.reactivated",
    entityType: "student",
    entityId: id,
  });
  return getStudent(id);
}
