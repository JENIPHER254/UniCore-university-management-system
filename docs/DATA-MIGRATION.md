# UniCore — Data Migration Documentation

Two related but separate concerns live here:

1. **Schema migrations** — versioned SQL files applied by the migration runner.
2. **CSV data import/export** — bulk loading of master data and financial records.

---

## 1. Schema migrations

### How it works

- Migration files are numbered SQL scripts in `db/migrations/`
  (e.g. `001_init.sql`, `002_add_xxx.sql` — applied in filename order).
- The runner (`apis/src/db/migrate.ts`) creates the `migration_history`
  table (if needed), then applies each **pending** file inside a single transaction:
  run file → on success record the filename in `migration_history`.
- Already-applied files are skipped — you can run `npm run migrate` as often as
  you like; it is always safe and repeatable.
- A failing migration rolls back completely (no half-applied schema).

### Commands

```bash
npm run migrate            # apply all pending migrations
npm run migrate:status     # list files and when each was applied
```

### Adding a migration

1. Write `002_short_name.sql` in `db/migrations/`.
2. Only forward changes (`CREATE/ALTER/DROP`); never overwrite or discard data.
   Example:

   ```sql
   -- db/migrations/002_add_nationality_to_students.sql
   ALTER TABLE students ADD COLUMN nationality TEXT NOT NULL DEFAULT '';
   ```

3. **Back up first**, on any system:

   ```bash
   cp db/data/unicore.db db/data/unicore.db.backup-$(date +%Y%m%d%H%M%S)
   ```

4. Run `npm run migrate` and verify with `npm run migrate:status`.

Rules: never edit an already-applied migration file. To change the schema of an
applied system, add a new numbered migration.

---

## 2. CSV import / export

### Entities, identities and columns

| Entity        | Matched by              | Required columns                                   | Optional columns |
|---------------|-------------------------|----------------------------------------------------|------------------|
| programmes    | `code` (unique)         | `code`, `name`                                     | `level`, `isActive` |
| departments   | `code` (unique)         | `code`, `name`                                     | `isActive` |
| students      | `email` (unique — one student per email) | `firstName`, `lastName`, `email`, `programmeCode`, `admissionDate` | `phone`, `studentNumber`, `status` |
| employees     | `email` (unique)        | `firstName`, `lastName`, `email`, `departmentCode`, `employmentDate` | `phone`, `employeeNumber`, `jobTitle`, `status` |
| fee_charges   | — (creates new charges) | `studentNumber`, `description`, `amount`, `chargeDate` | `category` |
| payments      | — (creates new payments) | `studentNumber`, `amount`, `paymentDate`           | `method`, `reference`, `note`, `isReversed`* |

\* `isReversed` may only be `0` on import — reversals must be done through the app
with an audited reason.

### Transformation rules

- Related records are joined **by code**, not by primary key:
  `programmeCode` → programmes.code, `departmentCode` → departments.code.
- `amount` is a decimal string with up to 2 places (e.g. `9500.50`);
  it is converted to integer cents at import.
- Dates must be `YYYY-MM-DD` (real calendar dates).
- `studentNumber` / `employeeNumber`: if blank or missing, a new number is
  allocated from the number series (`STU-#####`, `EMP-#####`).
- Programme/department `code`: if blank, one is auto-generated (`PRG-#####`, `DPT-#####`).
- Payment methods: `cash`, `bank_transfer`, `card`, `mobile_money`, `cheque`.

### Validation performed per row

- Missing/unknown required columns → the whole import is rejected up-front
  with the missing column names.
- Format checks: email syntax, date syntax/validity, decimal money format, > 0.
- Duplicate detection:
  - within the file (same `code`/`email` twice) → the second row is **skipped**
    with the reason `Duplicate … in file`;
  - against the database (already exists) → row **rejected** with a field message;
  - references that do not exist (e.g. unknown `programmeCode`) → **rejected**
    with `Programme 'XXX' not found`.

### Dry run

Send the same request with `"dryRun": true`:

```bash
curl -X POST http://localhost:4000/api/import/students \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dryRun": true, "csv": "studentNumber,firstName,…\n…"}'
```

Dry run validates every row and reports the result, then **rolls back the entire
transaction** — nothing is written (no rows, no audit entries, no consumed numbers).

### Committing an import

`"dryRun": false` (default). All rows import inside one transaction; a fatal
error (e.g. DB failure) rolls back the whole batch — never a partial import.
The response reports both totals and a per-row error map:

```json
{
  "entity": "students",
  "dryRun": false,
  "successful": 10,
  "rejected": 2,
  "skipped": 1,
  "rows": [
    { "row": 3, "status": "rejected",
      "errors": { "email": "Invalid email format" } },
    { "row": 4, "status": "skipped",
      "errors": { "code": "Duplicate code in file" } }
  ]
}
```

The UI (Import / Export page) renders this report row by row, field by field.

### Financial safety for imported charges/payments

- Charges only import for **active** students.
- Payments import for **active** students and are auto-allocated across open
  charges oldest-first, exactly like payments recorded in the app; allocations
  preserve the charge↔payment relationships that feed balances.
- Reversal state is never imported; reverse explicitly after import if history
  requires it (with reason → audit log).

### Export

```bash
curl http://localhost:4000/api/export/students.csv \
     -H "Authorization: Bearer $TOKEN" -o students.csv
```

Same column names as the import template — export → edit → import round-trips.
In the UI: **Import / Export** → choose data type → *Download CSV*.

### Templates

Sample templates (with an intentionally broken row to show error reporting)
are in `csv-templates/` at the repository root. Endpoints also serve current
data as a template (`GET /api/export/<entity>.csv`, "Load current data as
template" in the UI).

### Allowed roles

Import and export require authentication; every role may use it — but the
entities themselves obey module permissions for the *effects* (e.g. you still
can't inject rows you could not create via the API).

---

## 3. Round-trip checklist (export → import)

1. `GET /api/export/<entity>.csv` — snapshot data.
2. Edit the CSV (do not change header columns).
3. `POST /api/import/<entity>` with `dryRun: true` — fix all rejections/skips.
4. Back up the database file.
5. `POST /api/import/<entity>` with `dryRun: false`.
6. Check the summary and confirm `successful + rejected + skipped` equals the row count.

## 4. Restore/roll-forward procedure

CSV import is append-only; to undo a bad batch:

1. Restore the pre-import backup `unicore.db.backup-*` **or**
2. Perform the inverse actions through the app (reverse reversed-instance payments,
   deactivate imported students) so history stays auditable.

Never hand-edit the database file directly — that is the last resort and it is
exactly what the audit trail teaches you to avoid.
