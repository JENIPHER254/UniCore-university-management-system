-- ============================================================================
-- UniCore — migration 001: initial schema
--
-- Conventions (documented in docs/DATABASE.md):
--   * timestamps : TEXT, ISO-8601 UTC ("YYYY-MM-DDTHH:MM:SS.SSSZ")
--   * dates      : TEXT, "YYYY-MM-DD" (no time component)
--   * money      : INTEGER minor units (cents); currency lives in `settings`
--   * booleans   : INTEGER 0/1
--   * status     : TEXT code ('active' / 'inactive')
--
-- NOTE: the `migration_history` table is created and owned by the migration
-- runner (db/migrate.ts) before applying this file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Roles (code-based reference data)
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

INSERT INTO roles (code, name, description) VALUES
  ('administrator',            'Administrator',            'Full access to every module including users and settings'),
  ('finance_officer',          'Finance Officer',          'Fee charges, payments, reversals and financial reporting'),
  ('student_affairs_officer',  'Student Affairs Officer',  'Students and programmes'),
  ('hr_officer',               'HR Officer',               'Employees and departments');

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_code     TEXT NOT NULL REFERENCES roles(code),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- Programmes
-- ----------------------------------------------------------------------------
CREATE TABLE programmes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- Departments
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- Students
-- ----------------------------------------------------------------------------
CREATE TABLE students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_number TEXT NOT NULL UNIQUE,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT NOT NULL DEFAULT '',
  programme_id   INTEGER REFERENCES programmes(id),
  admission_date TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_students_programme ON students(programme_id);
CREATE INDEX idx_students_status    ON students(status);
CREATE INDEX idx_students_name      ON students(last_name, first_name);

-- ----------------------------------------------------------------------------
-- Employees
-- ----------------------------------------------------------------------------
CREATE TABLE employees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_number TEXT NOT NULL UNIQUE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT NOT NULL DEFAULT '',
  department_id   INTEGER REFERENCES departments(id),
  job_title       TEXT NOT NULL DEFAULT '',
  employment_date TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status     ON employees(status);
CREATE INDEX idx_employees_name       ON employees(last_name, first_name);

-- ----------------------------------------------------------------------------
-- Fee charges (immutable once created — mirrors posted documents)
-- ----------------------------------------------------------------------------
CREATE TABLE fee_charges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  charge_number TEXT NOT NULL UNIQUE,
  student_id    INTEGER NOT NULL REFERENCES students(id),
  category      TEXT NOT NULL DEFAULT 'tuition'
                CHECK (category IN ('tuition', 'accommodation', 'library', 'registration', 'other')),
  description   TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  charge_date   TEXT NOT NULL,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_charges_student ON fee_charges(student_id);

-- ----------------------------------------------------------------------------
-- Payments (immutable money movement; reversals are recorded, never deleted)
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number TEXT NOT NULL UNIQUE,
  student_id     INTEGER NOT NULL REFERENCES students(id),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  method         TEXT NOT NULL DEFAULT 'cash'
                 CHECK (method IN ('cash', 'bank_transfer', 'card', 'mobile_money', 'cheque')),
  reference      TEXT NOT NULL DEFAULT '',
  note           TEXT NOT NULL DEFAULT '',
  payment_date   TEXT NOT NULL,
  received_by    INTEGER NOT NULL REFERENCES users(id),
  is_reversed    INTEGER NOT NULL DEFAULT 0 CHECK (is_reversed IN (0, 1)),
  reversal_reason TEXT,
  reversed_by    INTEGER REFERENCES users(id),
  reversed_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_date    ON payments(payment_date);

-- ----------------------------------------------------------------------------
-- Payment allocations (payment <-> charge application entries)
-- ----------------------------------------------------------------------------
CREATE TABLE payment_allocations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id   INTEGER NOT NULL REFERENCES payments(id),
  charge_id    INTEGER NOT NULL REFERENCES fee_charges(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (payment_id, charge_id)
);

CREATE INDEX idx_allocations_charge ON payment_allocations(charge_id);

-- ----------------------------------------------------------------------------
-- Number series counters (maps to future AL "No. Series" exercises)
-- ----------------------------------------------------------------------------
CREATE TABLE number_series (
  key          TEXT PRIMARY KEY,
  prefix       TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0)
);

INSERT INTO number_series (key, prefix, current_value) VALUES
  ('student_number',  'STU', 1000),
  ('employee_number', 'EMP', 1000),
  ('programme_code',  'PRG', 100),
  ('department_code', 'DPT', 100),
  ('charge_number',   'CHR', 10000),
  ('payment_number',  'PMT', 10000);

-- ----------------------------------------------------------------------------
-- Audit logs
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL DEFAULT '',
  details     TEXT NOT NULL DEFAULT '{}',  -- JSON object
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Migration history — created and managed by the migration runner, listed here
-- for completeness of the data dictionary (see docs/DATABASE.md).
-- ----------------------------------------------------------------------------
-- CREATE TABLE migration_history (
--   id         INTEGER PRIMARY KEY AUTOINCREMENT,
--   name       TEXT NOT NULL UNIQUE,
--   applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
-- );

-- ----------------------------------------------------------------------------
-- Settings (key/value)
-- ----------------------------------------------------------------------------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO settings (key, value) VALUES
  ('org_name',    'UniCore University'),
  ('currency',    'ZAR'),
  ('currency_minor_units', '2');
