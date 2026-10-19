# UniCore — Database Documentation

SQLite (via better-sqlite3). Database file: `db/data/unicore.db` (git-ignored).
Schema is created by versioned migrations in `db/migrations/`; `db/schema.sql`
is a reference copy of the initial schema only.

## Storage conventions

| Concept    | Convention                                                        |
|------------|-------------------------------------------------------------------|
| Timestamps | TEXT, ISO-8601 UTC — `YYYY-MM-DDTHH:MM:SS.SSSZ` (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`) |
| Dates      | TEXT, `YYYY-MM-DD` (no time-of-day)                                |
| Money      | INTEGER **minor units (cents)**; currency + precision in `settings` |
| Booleans   | INTEGER 0/1                                                        |
| Status     | TEXT code: `active` / `inactive`                                   |

Every connection opened by `apis/src/db/index.ts` enables:

- `PRAGMA foreign_keys = ON` — FK enforcement can never be forgotten per-query
- `PRAGMA journal_mode = WAL` — safe concurrent readers

All queries are parameterized (prepared statements). Multi-write operations run
inside `db.transaction(...)` from `withTransaction`.

## Entity overview

```
roles ──< users
programmes ──< students
departments ──< employees
students ──< fee_charges ──< payment_allocations >── payments ──> users (received_by / reversed_by)
users ──< audit_logs
number_series   (allocation counters, one row per series)
settings        (key/value)
migration_history (managed by the migration runner)
```

## Tables

### roles
Reference data: `administrator`, `finance_officer`, `student_affairs_officer`, `hr_officer`.

### users
- `email` UNIQUE, `password_hash` (bcrypt, never plaintext)
- `role_code` FK → roles, `is_active`
- Self-protection rules live in `users.service.ts`: an admin cannot deactivate
  their own account or drop their own admin role.

### programmes / departments
- `code` UNIQUE (immutable after creation), `name`, `level` (programmes only), `is_active`

### students
- `student_number` UNIQUE (`STU-#####`), `email` UNIQUE
- `programme_id` FK → programmes
- `admission_date`, `status`

### employees
- `employee_number` UNIQUE (`EMP-#####`), `email` UNIQUE
- `department_id` FK → departments
- `job_title`, `employment_date`, `status`

### fee_charges
- `charge_number` UNIQUE (`CHR-#####`), `student_id` FK, `category`
- `amount_cents > 0`, `charge_date`, `created_by` FK → users
- **Immutable**: no UPDATE/DELETE endpoints exist. Correcting a charge would
  corrupt allocation history; reversals exist for payments, not charges.

### payments
- `payment_number` UNIQUE (`PMT-#####`), `student_id` FK, `amount_cents > 0`
- `method` ∈ `cash | bank_transfer | card | mobile_money | cheque`
- `reference` (external doc/bank ref), `note`, `payment_date`
- `received_by` FK → users
- **Reversal by flag, never delete**: `is_reversed=1`, `reversal_reason`,
  `reversed_by`, `reversed_at`. A reversed payment can only be reversed once (409 on retry).

### payment_allocations
- Junction linking payments to fee_charges: `payment_id`, `charge_id`,
  `amount_cents`, `UNIQUE(payment_id, charge_id)`
- Allocations of a *reversed* payment are kept for audit but are excluded from
  every balance/open calculation (`JOIN payments … WHERE is_reversed = 0`).

### number_series
One row per series (`STU`, `EMP`, `PRG`, `DPT`, `CHR`, `PMT`) with `prefix` and
`current_value`. `nextNumber()` allocates inside a transaction — concurrent-safe
under better-sqlite3's single-writer semantics. This is the counterpart of the
future AL "No. Series" exercise.

### audit_logs
`user_id, action, entity_type, entity_id, details (JSON), created_at`.
Written for logins, student/employee/programme/department changes, charges,
payments, reversals, user admin changes and settings updates.

### settings
`org_name`, `currency` (ISO-4217 code), `currency_minor_units` (decimal digits).

## The money math (single source of truth)

All finance queries derive the same primitives:

```sql
-- allocated to a charge by VALID payments
allocated(c) = SUM(allocations.amount_cents)
               WHERE charge_id = c AND payment.is_reversed = 0

-- open amount of a charge
open(c)  = c.amount_cents − allocated(c)

-- account-level totals (students)
charges_total    = SUM(fee_charges.amount_cents)
payments_total   = SUM(payments.amount_cents WHERE is_reversed = 0)
outstanding      = charges_total − payments_total
```

- Auto-allocation fills charges FIFO by charge date.
- A payment may exceed total charges (account credit): `outstanding` goes negative —
  shown as `0.00 … (credit)` semantics kept simple in v1.
- Dashboard `outstandingCents` uses the same account-level formula.

## Referential integrity

- FKs enforced (`PRAGMA foreign_keys = ON`).
- Financial history is protected: charges/payments have no delete endpoints;
  FK constraints block accidental deletion of students/programmes/departments
  referenced by history (SQLite raises `FOREIGN KEY constraint failed`).
- Deactivation (status change) is the supported "removal".

## Indexes

`s_students_programme`, `s_students_status`, `s_students_name(last, first)`,
`employees(department_id)`, `employees(status)`, `employees(last, first)`,
`fee_charges(student_id)`, `payments(student_id)`, `payments(payment_date)`,
`payment_allocations(charge_id)`, `audit_logs(entity_type, entity_id)`.

## Migration & backup procedure

```bash
# backup first
cp db/data/unicore.db db/data/unicore.db.backup-$(date +%Y%m%d%H%M%S)

# apply pending migrations (repeatable, tracked in migration_history)
npm run migrate
npm run migrate:status
```

The runner wraps each migration file in a transaction; a failure rolls back the
whole file, leaving `migration_history` untouched for a clean retry. Applied
files are never re-applied. See `docs/DATA-MIGRATION.md` for CSV workflows.

## Future Business Central mapping

See `docs/BC-AL-MAPPINGS.md` for how these tables map to AL tables, ledger
concepts and number series.
