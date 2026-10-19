import type { z } from "zod";
import { getDb, nowIso, withTransaction } from "../db/index.js";
import { nextNumber } from "../lib/numbers.js";
import { writeAudit } from "../lib/audit.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import type { chargeSchema, paymentSchema, reversalSchema } from "../validation/schemas.js";

export type ChargeInput = z.infer<typeof chargeSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ReversalInput = z.infer<typeof reversalSchema>;

type Db2 = ReturnType<typeof getDb>;

// ---- Charges ----------------------------------------------------------------
export function createCharge(input: ChargeInput, actorId: number) {
  const db = getDb();
  return withTransaction(db, () => {
    assertStudentActive(db, input.studentId);
    const amountCents = parseMoney(input.amount);
    const chargeNumber = nextNumber(db, "charge_number");
    const res = db
      .prepare(
        `INSERT INTO fee_charges (charge_number, student_id, category, description, amount_cents, charge_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(chargeNumber, input.studentId, input.category, input.description, amountCents, input.chargeDate, actorId);
    writeAudit(db, {
      userId: actorId,
      action: "charge.created",
      entityType: "fee_charge",
      entityId: res.lastInsertRowid,
      details: { chargeNumber, amountCents, category: input.category },
    });
    return db.prepare("SELECT * FROM fee_charges WHERE id = ?").get(res.lastInsertRowid);
  });
}

/** Payments that are not reversed, per charge. */
const ALLOCATED_ON_CHARGE_SQL = `
  (SELECT COALESCE(SUM(a.amount_cents), 0) FROM payment_allocations a
   JOIN payments p2 ON p2.id = a.payment_id
   WHERE a.charge_id = c.id AND p2.is_reversed = 0)`;

/** Open (unpaid) amount per charge in cents. */
const OPEN_ON_CHARGE_SQL = `(c.amount_cents - ${ALLOCATED_ON_CHARGE_SQL})`;

export function listCharges(q: { studentId?: number; page?: number; pageSize?: number; q?: string }) {
  const db = getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.studentId !== undefined) {
    where.push("c.student_id = ?");
    params.push(q.studentId);
  }
  if (q.q) {
    where.push("(c.charge_number LIKE ? OR c.description LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ?)");
    for (let i = 0; i < 5; i++) params.push(`%${q.q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM fee_charges c LEFT JOIN students s ON s.id = c.student_id ${whereSql}`)
      .get(...params) as { n: number }
  ).n;
  const data = db
    .prepare(
      `SELECT c.id, c.charge_number AS chargeNumber, c.student_id AS studentId,
              s.student_number AS studentNumber, s.first_name AS firstName, s.last_name AS lastName,
              c.category, c.description, c.amount_cents AS amountCents, c.charge_date AS chargeDate,
              ${ALLOCATED_ON_CHARGE_SQL} AS allocatedCents,
              ${OPEN_ON_CHARGE_SQL} AS openCents
       FROM fee_charges c LEFT JOIN students s ON s.id = c.student_id
       ${whereSql} ORDER BY c.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---- Payments ---------------------------------------------------------------
/** Allocates the payment across the student's open charges (FIFO by date) or validates explicit allocations. */
function applyAllocations(
  db: Db2,
  paymentId: number,
  studentId: number,
  amountCents: number,
  explicit: { chargeId: number; amountCents: number }[] | undefined
): { allocatedCents: number; allocations: { chargeId: number; amountCents: number }[] } {
  const insert = db.prepare(
    "INSERT INTO payment_allocations (payment_id, charge_id, amount_cents) VALUES (?, ?, ?)"
  );
  const allocations: { chargeId: number; amountCents: number }[] = [];

  const openOn = (chargeId: number) =>
    Number(
      (
        db
          .prepare(
            `SELECT (c.amount_cents - COALESCE((SELECT SUM(a.amount_cents) FROM payment_allocations a
                      JOIN payments p2 ON p2.id = a.payment_id WHERE a.charge_id = c.id AND p2.is_reversed = 0), 0)) AS open
             FROM fee_charges c WHERE c.id = ? AND c.student_id = ?`
          )
          .get(chargeId, studentId) as { open: number } | undefined
      )?.open ?? -1
    );

  if (explicit && explicit.length > 0) {
    let sum = 0;
    for (const item of explicit) {
      const open = openOn(item.chargeId);
      if (open < 0) throw badRequest(`Charge ${item.chargeId} does not belong to this student`);
      if (item.amountCents <= 0) throw badRequest("Allocation amounts must be positive");
      if (item.amountCents > open)
        throw badRequest(
          `Allocation exceeds the open amount of charge ${item.chargeId} (open: ${(open / 100).toFixed(2)})`
        );
      sum += item.amountCents;
      if (sum > amountCents) throw badRequest("Allocations exceed the payment amount");
      insert.run(paymentId, item.chargeId, item.amountCents);
      allocations.push({ chargeId: item.chargeId, amountCents: item.amountCents });
    }
    return { allocatedCents: sum, allocations };
  }

  // Auto-allocate FIFO across open charges.
  let remaining = amountCents;
  const openCharges = db
    .prepare(
      `SELECT c.id, (${OPEN_ON_CHARGE_SQL}) AS openCents
       FROM fee_charges c WHERE c.student_id = ? AND (${OPEN_ON_CHARGE_SQL}) > 0
       ORDER BY c.charge_date, c.id`
    )
    .all(studentId) as { id: number; openCents: number }[];
  for (const ch of openCharges) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, ch.openCents);
    insert.run(paymentId, ch.id, applied);
    allocations.push({ chargeId: ch.id, amountCents: applied });
    remaining -= applied;
  }
  return { allocatedCents: amountCents - remaining, allocations };
}

export function createPayment(input: PaymentInput, actorId: number) {
  const db = getDb();
  return withTransaction(db, () => {
    assertStudentActive(db, input.studentId);
    const amountCents = parseMoney(input.amount);
    if (amountCents <= 0) throw badRequest("Payment amount must be greater than zero");
    const paymentNumber = nextNumber(db, "payment_number");
    const res = db
      .prepare(
        `INSERT INTO payments (payment_number, student_id, amount_cents, method, reference, note, payment_date, received_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        paymentNumber,
        input.studentId,
        amountCents,
        input.method,
        input.reference,
        input.note,
        input.paymentDate,
        actorId
      );
    const paymentId = Number(res.lastInsertRowid);
    const explicit = input.allocations?.map((a) => ({
      chargeId: a.chargeId,
      amountCents: Math.round(Number(a.amount) * 100),
    }));
    const { allocatedCents } = applyAllocations(db, paymentId, input.studentId, amountCents, explicit);
    writeAudit(db, {
      userId: actorId,
      action: "payment.recorded",
      entityType: "payment",
      entityId: paymentId,
      details: { paymentNumber, amountCents, allocatedCents, method: input.method },
    });
    return db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  });
}

export function listPayments(q: { studentId?: number; page?: number; pageSize?: number; q?: string }) {
  const db = getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.studentId !== undefined) {
    where.push("p.student_id = ?");
    params.push(q.studentId);
  }
  if (q.q) {
    where.push("(p.payment_number LIKE ? OR p.reference LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ?)");
    for (let i = 0; i < 5; i++) params.push(`%${q.q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM payments p LEFT JOIN students s ON s.id = p.student_id ${whereSql}`)
      .get(...params) as { n: number }
  ).n;
  const data = db
    .prepare(
      `SELECT p.id, p.payment_number AS paymentNumber, p.student_id AS studentId,
              s.student_number AS studentNumber, s.first_name AS firstName, s.last_name AS lastName,
              p.amount_cents AS amountCents, p.method, p.reference, p.note, p.payment_date AS paymentDate,
              p.is_reversed AS isReversed, p.reversal_reason AS reversalReason, p.reversed_at AS reversedAt
       FROM payments p LEFT JOIN students s ON s.id = p.student_id
       ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Controlled payment reversal: the payment is never deleted; it is flagged
 * reversed with reason + actor, so its allocations no longer count towards
 * balances (previous allocations stay in the table for the audit trail).
 */
export function reversePayment(paymentId: number, input: ReversalInput, actorId: number) {
  const db = getDb();
  return withTransaction(db, () => {
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as
      | { id: number; payment_number: string; is_reversed: number }
      | undefined;
    if (!payment) throw notFound("Payment not found");
    if (payment.is_reversed === 1) throw conflict("This payment has already been reversed");
    db.prepare(
      "UPDATE payments SET is_reversed = 1, reversal_reason = ?, reversed_by = ?, reversed_at = ? WHERE id = ?"
    ).run(input.reason, actorId, nowIso(), paymentId);
    writeAudit(db, {
      userId: actorId,
      action: "payment.reversed",
      entityType: "payment",
      entityId: paymentId,
      details: { paymentNumber: payment.payment_number, reason: input.reason },
    });
    return db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  });
}

// ---- Shared helpers ---------------------------------------------------------
function assertStudentActive(db: Db2, studentId: number) {
  const student = db.prepare("SELECT id, status FROM students WHERE id = ?").get(studentId) as
    | { id: number; status: string }
    | undefined;
  if (!student) throw badRequest("Student does not exist");
  if (student.status !== "active")
    throw badRequest("This student is inactive — reactivate the student first");
}

export function parseMoney(input: string): number {
  const value = Number(input);
  if (!Number.isFinite(value)) throw badRequest("Invalid amount");
  return Math.round(value * 100);
}
