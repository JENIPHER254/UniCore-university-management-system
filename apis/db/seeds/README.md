# db/seeds

Development **seed** entry point for UniCore. This folder documents the seeding
workflow; the implementation lives in `apis/src/db/seed.ts` so it can reuse the
app's shared database helpers and migration runner.

## Usage

```bash
# from the repository root
npm run seed
```

What it does (synthetic development data only — never production data):

1. Applies any pending migrations first (same as `npm run migrate`).
2. Creates the initial administrator from `SEED_ADMIN_EMAIL` and
   `SEED_ADMIN_INITIAL_PASSWORD` in `.env` if that account does not exist yet.
   The password is never printed to the console or stored anywhere in plaintext.
3. Inserts demo programmes, departments, students, employees, fee charges and
   payments. Rows already present are left untouched, so re-running is harmless.
4. Writes the seeded financial records to `audit_logs` for traceability.

Idempotency: re-running the seed will not duplicate entities (it matches on
email/name and skips existing charges for already-billed students).
