# UniCore — University Management System

A minimalist university management system built with React, Node.js, Express, and SQLite, featuring Student Management, Finance, and HR modules, with data migration and Microsoft Dynamics 365 Business Central (AL) learning objectives in mind.

## Modules

- **Student Management** — students, programmes, profiles, status (activate/deactivate)
- **Finance** — fee charges, payments with auto-allocation, controlled reversals, balances
- **Human Resources** — employees, departments, profiles, status
- **Dashboard** — live figures straight from the database
- **Users & Roles** — administrator, finance officer, student affairs officer, HR officer
- **Import / Export** — CSV round-trip from/to the live SQLite tables
- **Settings** — organisation name and currency

## Repository layout

```
frontend/     Next.js + TypeScript + Tailwind CSS UI
apis/         Node.js + Express + TypeScript REST API
db/
  migrations/ Versioned SQL migrations (authoritative schema)
  seeds/      Development seed script
  schema.sql  Reference copy of the initial schema
docs/         SRS, database and data-migration documentation
csv-templates/ Sample CSV templates for import/export
```

## Requirements

- Node.js 20 or newer (tested on Node 24)
- npm 10 or newer

## Exact configuration in use

| Item | Value |
|---|---|
| Backend URL | `http://localhost:4000` (set by `PORT` in `.env`) |
| Frontend URL | `http://localhost:3000` (Next.js dev server) |
| Swagger UI | `http://localhost:4000/api/docs` (alias: `http://localhost:4000/api-docs`) |
| OpenAPI JSON | `http://localhost:4000/api/openapi.json` |
| SQLite file | `db/data/unicore.db` (set by `DATABASE_PATH` in `.env`) |

### How to verify the backend really uses that SQLite file

```bash
npm run migrate:status                     # shows db/migrations applied to db/data/unicore.db
curl http://localhost:4000/api/health      # {"ok":true} — backend is up
```

While the API is running, the file will show WAL companions (`unicore.db-wal`, `unicore.db-shm`) in `db/data/`.
`apis/src/config.ts` resolves `DATABASE_PATH` relative to the project root, and both the migrations, seed script
and the API share the same resolver — there is only one database file in play.

## Setup

From the project root:

```bash
# 1) Install all workspace dependencies
npm install
npm run setup

# 2) Create environment file from the template
cp .env.example .env
# adjust values if needed; do not commit the real secrets

# 3) Initialize the SQLite database schema (no demo data unless you choose to seed)
npm run migrate

# 4) OPTIONAL: seed a first administrator + demo records
npm run seed
```

The seed script creates the first admin account using the values in `.env` (`SEED_ADMIN_EMAIL` and
`SEED_ADMIN_INITIAL_PASSWORD`), plus clearly-labelled demo records (`@example.edu` addresses, `SEED-` payment
references). It is additive and marks everything it creates — re-running migrates nothing twice. If you want a
database with **only** your own data, run `npm run migrate` and skip `npm run seed` (you can bootstrap your admin
in production then via the seed script or direct insert).

## Running the system locally

Open two terminals from the project root:

```bash
# Terminal 1: API on http://localhost:4000
npm run dev:api

# Terminal 2: frontend on http://localhost:3000
npm run dev:web
```

`npm run dev:web` runs the Next.js dev server (`next dev`) from `frontend/`; no `database` in the frontend
process — all data is fetched over the API with a bearer token.

Then open:

- Frontend: http://localhost:3000
- API docs (Swagger UI): http://localhost:4000/api/docs or http://localhost:4000/api-docs
- JSON spec: http://localhost:4000/api/openapi.json
- Health check: http://localhost:4000/api/health

### CORS notes

`CORS_ORIGIN` in `.env` accepts a single origin or a comma-separated list. Local development origins
(`http://localhost:*`, `http://127.0.0.1:*`) are additionally allowed automatically when `NODE_ENV` is not
`production` — so the default frontend port (3000) just works without editing anything.

## Swagger / API documentation

The backend exposes Swagger/OpenAPI docs at `/api/docs` (and `/api-docs`) with the JSON spec at `/api/openapi.json`.

- All 26 implemented endpoint paths are documented: auth, dashboard, students, programmes, departments,
  employees, finance (charges/payments/reversal/student statement), users, settings, and CSV import/export.
- Every POST / PUT / PATCH has an editable `application/json` request body pre-filled with a realistic example
  matching the Zod validation in `apis/src/validation/schemas.ts`.
- `Try it out → Execute` runs a real request against the running backend and the real SQLite file. Use the
  **Authorize** button (top right) and paste your bearer token first.
- GET endpoints use query parameters (search `q`, filters, `page`/`pageSize`) — no request bodies on GETs.

## Production build

```bash
npm run build
npm start
```

This builds the API and frontend, then serves the API on `PORT` and static frontend assets from `frontend/dist`.

## Database

- SQLite file: `db/data/unicore.db`
- Foreign keys are enforced on every connection (`PRAGMA foreign_keys = ON`).
- Schema changes are managed with versioned SQL migrations in `db/migrations/`.
- Migration history is tracked in `migration_history`.
- Money is stored as integer minor units (cents); balances are always *computed* from
  `fee_charges` and non-reversed `payments` rows — never stored/edited directly.
- Payments are never deleted; reversal is recorded with reason + actor (`payments.is_reversed`).

```bash
npm run migrate           # apply pending migrations
npm run migrate:status    # show applied / pending migrations
```

Backup before running migrations:

```bash
cp db/data/unicore.db db/data/unicore.db.backup-$(date +%Y%m%d%H%M%S)
```

## Tests

```bash
npm test
```

This runs the backend test suite (39 tests) covering auth, permissions, students, finance logic, CSV import and migration flows, using temporary per-test database files so your real data is never touched.

## CSV import / export

Sample templates live in `csv-templates/`. See `docs/DATA-MIGRATION.md` for field mappings, validation rules, dry-run mode and restart/recovery procedures. Import runs inside a transaction and accepts `dryRun: true` to validate without writing.

## Documentation

- `docs/SRS.md` — software requirements specification
- `docs/DATABASE.md` — schema, relationships, storage conventions
- `docs/DATA-MIGRATION.md` — migrations and CSV import/export
- `docs/BC-AL-MAPPINGS.md` — future Business Central / AL learning mappings

## Licence

Internal learning project — not for production use.
