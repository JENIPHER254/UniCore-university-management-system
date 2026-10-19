# UniCore — Software Requirements Specification (MVP)

A minimalist University Management System built as a practical learning project for
full-stack development, Microsoft Dynamics 365 Business Central (AL), and data migration.

## 1. Purpose and audience

UniCore manages the core administrative workflow of a small university:
students, programmes, fee charges and payments, employees and departments.
It is intentionally small, reliable and maintainable. Its process shapes are
designed to map onto future Business Central / AL learning exercises
(see `docs/BC-AL-MAPPINGS.md`). It is **not** a complete accounting,
payroll, or enterprise ERP system.

## 2. Technology stack

| Layer     | Technology                                        |
|-----------|---------------------------------------------------|
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend   | Node.js, Express 5, TypeScript, Zod validation, REST |
| Database  | SQLite via better-sqlite3, versioned SQL migrations |
| Auth      | bcrypt password hashing + JWT bearer tokens        |

## 3. Roles and permissions

Four roles; authorization is enforced on the backend for every endpoint —
the frontend only hides navigation.

| Module            | Administrator | Finance Officer | Student Affairs Officer | HR Officer |
|-------------------|:---:|:---:|:---:|:---:|
| Dashboard         | ✔ | ✔ | ✔ | ✔ |
| Students          | ✔ | ✖ | ✔ | ✖ |
| Programmes        | ✔ | ✖ | ✔ | ✖ |
| Finance           | ✔ | ✔ | ✖ | ✖ |
| Human Resources   | ✔ | ✖ | ✖ | ✔ |
| User Management   | ✔ | ✖ | ✖ | ✖ |
| Settings          | ✔ | ✖ | ✖ | ✖ |
| Import / Export   | ✔ | ✔ | ✔ | ✔ |

There is no public registration. The initial administrator is created by the
seed script from `SEED_ADMIN_*` values in `.env`.

## 4. Functional requirements

### 4.1 Students
- FR-ST1: Register students with a unique auto-generated student number (`STU-…`).
- FR-ST2: Store first/last name, email (unique), phone, programme, admission date, status.
- FR-ST3: List, search (name/email/number), filter (programme, status), paginate.
- FR-ST4: View a profile with editable data, fee statement and lifecycle history.
- FR-ST5: Edit student information; email changes re-checked for uniqueness.
- FR-ST6: Deactivate/reactivate students without deleting any records.

### 4.2 Programmes
- FR-PR1: Create/list/edit programmes with a user-supplied or auto-generated code.
- FR-PR2: Code is immutable after creation; inactive programmes hidden from default lists.

### 4.3 Finance
- FR-FI1: Create fee charges for active students; amounts stored as integer cents.
- FR-FI2: Charges are immutable once created (posted-document semantics).
- FR-FI3: Record payments with date, amount, method, reference, note.
- FR-FI4: Generate unique payment references (`PMT-…`).
- FR-FI5: Auto-allocate payments to open charges FIFO; explicit allocation optional.
- FR-FI6: Controlled payment reversal with mandatory reason; payments are never deleted.
- FR-FI7: Balance = total valid charges − total valid (non-reversed) payments.
- FR-FI8: Financial summary and full transaction history per student.
- FR-FI9: Payments only against active students (reactivate first).

### 4.4 Human Resources
- FR-HR1: Register employees with unique employee number (`EMP-…`).
- FR-HR2: Store name, email (unique), phone, department, job title, employment date, status.
- FR-HR3: List, search, filter by department/status, paginate.
- FR-HR4: Deactivate/reactivate without deleting records.
- FR-HR5: Department management (code immutable after creation).

### 4.5 Dashboard
- FR-DB1: Show active students, active employees, total payments received, outstanding fees.
- FR-DB2: Show five most recent students and payments.
- FR-DB3: All figures computed from the database at request time — no mock values.

### 4.6 Users & settings
- FR-US1: Administrators create users, change roles, reset passwords, deactivate.
- FR-US2: Users cannot deactivate themselves or remove their own admin role.
- FR-US3: Users change their own password with the current password.
- FR-ST4b: Settings store org name, currency code and decimal precision.

### 4.7 Data migration
- FR-DM1: Versioned SQL migrations; history table; repeatable; never silently destructive.
- FR-DM2: CSV import for students, programmes, departments, employees, fee charges, payments
  with per-row validation, duplicate detection, dry-run mode and a summary report.
- FR-DM3: CSV export for all imported entities.
- FR-DM4: Imports run in a transaction; failures never leave partial batches.

## 5. Non-functional requirements

- NFR1 Security: bcrypt hashing, JWT expiry, parameterized SQL, server-side validation,
  no secrets in source control, no sensitive data in logs.
- NFR2 Usability: responsive layout (desktop/tablet/mobile), searchable & paginated tables,
  clear loading/empty/error states, confirmation dialogs for consequential actions.
- NFR3 Correctness: decimal-safe money (integer cents), transactional financial operations.
- NFR4 Maintainability: strict TypeScript, modular services/routes, documented schema.
- NFR5 Testability: basic automated tests for auth, permissions, students, finance math,
  payment reversal, migration and CSV import (`apis/src/tests`).

## 6. Out of scope (v1)

General ledger, payroll, procurement, budgeting, bank reconciliation, leave management,
recruitment, performance management, external integrations, e-mail/SMS notifications.

## 7. Acceptance criteria (Definition of Done)

- The app runs locally from documented instructions (`npm install && npm run setup`,
  `npm run migrate && npm run seed`, `npm run dev:api` + `npm run dev:web`).
- A seeded user can sign in and only sees permitted modules; the API rejects
  cross-module calls with 403.
- Student, programme, employee and department CRUD persists in SQLite.
- Charges, payments, reversals and balances reconcile exactly (`docs/DATABASE.md`).
- Dashboard figures match database queries.
- `npm run migrate` is idempotent; migration history prevents re-application.
- CSV import validates, reports per-row errors, supports dry-run, and rolls back
  fully on fatal errors; CSV export round-trips.
- Important financial/administrative actions are written to `audit_logs`.
- `npm test` covers the critical workflows.
