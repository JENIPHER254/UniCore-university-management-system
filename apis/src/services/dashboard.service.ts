import { getDb } from "../db/index.js";

/** All figures come straight from the database — nothing hardcoded. */
export function getDashboard() {
  const db = getDb();

  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE status = 'active') AS activeStudents,
        (SELECT COUNT(*) FROM students) AS totalStudents,
        (SELECT COUNT(*) FROM employees WHERE status = 'active') AS activeEmployees,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE is_reversed = 0) AS paymentsReceivedCents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM fee_charges)
          - (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE is_reversed = 0) AS outstandingCents`
    )
    .get() as {
    activeStudents: number;
    totalStudents: number;
    activeEmployees: number;
    paymentsReceivedCents: number;
    outstandingCents: number;
  };

  const recentStudents = db
    .prepare(
      `SELECT s.id, s.student_number AS studentNumber, s.first_name AS firstName, s.last_name AS lastName,
              p.name AS programmeName, s.admission_date AS admissionDate, s.status
       FROM students s LEFT JOIN programmes p ON p.id = s.programme_id
       ORDER BY s.id DESC LIMIT 5`
    )
    .all();

  const recentPayments = db
    .prepare(
      `SELECT p.id, p.payment_number AS paymentNumber, p.amount_cents AS amountCents,
              s.first_name AS firstName, s.last_name AS lastName, s.student_number AS studentNumber,
              p.payment_date AS paymentDate, p.is_reversed AS isReversed, p.method
       FROM payments p LEFT JOIN students s ON s.id = p.student_id
       ORDER BY p.id DESC LIMIT 5`
    )
    .all();

  return { totals, recentStudents, recentPayments };
}
