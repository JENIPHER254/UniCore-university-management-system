# UniCore — University Management System

A minimalist university management system built with React, Node.js, Express, and SQLite, featuring Student Management, Finance, and HR modules, with data migration and Microsoft Dynamics 365 Business Central (AL) learning objectives in mind.

## Modules

- **Student Management** — students, programmes, profiles, status (activate/deactivate)
- **Finance** — fee charges, payments with auto-allocation, controlled reversals, balances
- **Human Resources** — employees, departments, profiles, status
- **Dashboard** — live figures straight from the database
- **Users & Roles** — administrator, finance officer, student affairs officer, HR officer
- **Settings** — organisation name and currency

## Repository layout

```
frontend/     React + TypeScript + Vite + Tailwind CSS
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

## Setup

From the project root:

```bash
# 1) Install all workspace dependencies
npm install
npm run setup

# 2) Create environment file from the template
cp .env.example .env
# adjust values if needed; do not commit the real secrets

# 3) Initialize the SQLite database schema and seed development records
npm run migrate
npm run seed
```

The seed script creates the first admin account using the values in `.env` (`SEED_ADMIN_EMAIL` and `SEED_ADMIN_INITIAL_PASSWORD`). The password is not printed to the console, but the seeded admin email is.

## Running the system locally

Open two terminals from the project root:

```bash
# Terminal 1: API on http://localhost:4000
npm run dev:api

# Terminal 2: frontend on http://localhost:5173
npm run dev:web
```

Then open:

- Frontend: http://localhost:5173
- API docs: http://localhost:4000/api/docs
- Health check: http://localhost:4000/api/health

## Production build

```bash
npm run build
npm start
```

This builds the API and frontend, then serves the API on `PORT` and static frontend assets from `frontend/dist`.

## API documentation

The backend exposes Swagger/OpenAPI docs at `/api/docs` and a JSON spec at `/api/openapi.json`.

Use the docs to review request and response shapes, authentication, and the available endpoints for students, finance, employees, and imports.

## Database

- SQLite file: `db/data/unicore.db`
- Foreign keys are enforced on every connection.
- Schema changes are managed with versioned SQL migrations in `db/migrations/`.
- Migration history is tracked in `migration_history`.

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

This runs the backend test suite covering auth, permissions, students, finance logic, CSV import and migration flows.

## CSV import / export

Sample templates live in `csv-templates/`. See `docs/DATA-MIGRATION.md` for field mappings, validation rules, dry-run mode and restart/recovery procedures.

## Documentation

- `docs/SRS.md` — software requirements specification
- `docs/DATABASE.md` — schema, relationships, storage conventions
- `docs/DATA-MIGRATION.md` — migrations and CSV import/export
- `docs/BC-AL-MAPPINGS.md` — future Business Central / AL learning mappings

## Licence

Internal learning project — not for production use.
