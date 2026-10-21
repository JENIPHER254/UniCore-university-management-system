-- ============================================================================
-- UniCore — initial schema (REFERENCE COPY)
--
-- This file is a human-readable reference for the INITIAL database schema.
-- The AUTHORITATIVE sources are the versioned migrations in db/migrations/.
-- Run `npm run migrate` to create the database from 001_init.sql.
--
-- Conventions (see docs/DATABASE.md):
--   * timestamps : TEXT, ISO-8601 UTC ("YYYY-MM-DDTHH:MM:SS.SSSZ")
--   * dates      : TEXT, "YYYY-MM-DD"
--   * money      : INTEGER minor units (cents); currency lives in `settings`
--   * booleans   : INTEGER 0/1
-- ============================================================================

-- Roles (code-based reference data)
CREATE TABLE roles (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- Users
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

-- Programmes
CREATE TABLE programmes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Departments
CREATE TABLE departments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Students
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

-- Employees
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

-- Fee charges (immutable once created)
CREATE TABLE fee_charges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  charge_number TEXT NOT NULL UNIQUE,
  student_id    INTEGER NOT NULL REFERENCES students(id),
  category      TEXT NOT NULL DEFAULT 'tuition',
  description   TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  charge_date   TEXT NOT NULL,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Payments (immutable; reversals recorded, never deleted)
CREATE TABLE payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number  TEXT NOT NULL UNIQUE,
  student_id      INTEGER NOT NULL REFERENCES students(id),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  method          TEXT NOT NULL DEFAULT 'cash',
  reference       TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  payment_date    TEXT NOT NULL,
  received_by     INTEGER NOT NULL REFERENCES users(id),
  is_reversed     INTEGER NOT NULL DEFAULT 0 CHECK (is_reversed IN (0, 1)),
  reversal_reason TEXT,
  reversed_by     INTEGER REFERENCES users(id),
  reversed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Payment allocations (payment <-> charge application entries)
CREATE TABLE payment_allocations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id   INTEGER NOT NULL REFERENCES payments(id),
  charge_id    INTEGER NOT NULL REFERENCES fee_charges(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (payment_id, charge_id)
);

-- Number series counters (maps to future AL "No. Series" exercises)
CREATE TABLE number_series (
  key           TEXT PRIMARY KEY,
  prefix        TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0)
);

-- Audit logs
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL DEFAULT '',
  details     TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Migration history (created and managed by the migration runner)
-- CREATE TABLE migration_history (
--   id         INTEGER PRIMARY KEY AUTOINCREMENT,
--   name       TEXT NOT NULL UNIQUE,
--   applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
-- );

-- Settings (key/value)
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
