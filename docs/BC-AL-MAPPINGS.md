# UniCore → Business Central / AL learning mappings

UniCore intentionally mirrors common ERP patterns so its processes can be
re-implemented in AL for practice **inside a Business Central environment**.
The app itself stays completely independent of Business Central — these are
study notes, not code dependencies.

## Data model mappings

| UniCore (SQLite)                     | Business Central / AL concept                                        |
|--------------------------------------|----------------------------------------------------------------------|
| `students`, `employees` tables       | Master data tables (e.g. "Resource", "Customer") in an AL **table**; primary key `student_number` = Code(20) fields |
| `programmes`, `departments`          | Setup/reference tables with `TableRelation`                          |
| `payment_allocations`                | Ledger "application" entries concept (e.g. Customer ledger entry application) |
| `fee_charges` (immutable)            | **Posted documents / ledger entries**: created once, never edited    |
| `payments` + reversal                | Ledger entries + **Void transaction** pattern with reason code       |
| `number_series` + `nextNumber()`     | AL **No. Series** / `NoSeriesMgt.GetNextNo()` (date-linked, year prefix) |
| `settings` (key/value)               | "Setup" table (card page) instead of key/value pairs                 |
| `migration_history`                  | Dosage of the **Data Migration** schema + `Configuration Package`    |
| `audit_logs`                         | Change Log + Tracking/insert to an audit table in AL                 |
| per-row CSV validation errors        | Validation failures in Config. Package import (`ErrorText` buffers)  |

## Business logic mappings

| UniCore backend rule (TypeScript)                  | AL equivalent to practise                                           |
|-----------------------------------------------------|---------------------------------------------------------------------|
| Zod schema validation per endpoint                  | `Field`/`Record` `OnValidate` triggers + `TestField` assertions      |
| "charges are immutable"                             | `Modify=false` in table properties, page `Editable=false` after posting |
| Payment auto-allocation FIFO                        | Application logic via `Entry := …` / `Apply` on ledger entries        |
| Payment reversal with reason                        | Reverse/void posting with `Reason Code` and an audit entry            |
| Balance = charges − valid payments                  | FlowFields (`CalcFields`) with `Sum` + filter on open entries, or `CalcSums` |
| Deactivation status pattern (`active`/`inactive`)   | `Blocked` boolean field and `Err` guards on posting                   |
| Role-based endpoint permissions                     | User group/permission sets + `permissionset` AL object                |
| OpenAPI/REST endpoints                              | API pages + `api` property (v2.0 web API)                             |

## UI mappings

| UniCore React page                    | BC page type to recreate                                       |
|----------------------------------------|----------------------------------------------------------------|
| Students list (search/filter/paging)   | **List page** + `RunTrigger`, filter controls, "My List" style  |
| Student profile                        | **Card page** with FastTabs (charges, payments, stats)         |
| Finance dashboard                      | Role Center with Cue tiles (counts via FlowFields)             |
| Import/Export page (per-row errors)    | Config. Package worksheet + generic import with error log      |
| Confirmation dialogs                   | `Confirm()` calls in posting codeunits                         |

## Suggested exercise sequence

1. Recreate `students` as an AL table + card/list pages with a No. Series.
2. Add a `fee_charges` "charges ledger" with an immutable posting codeunit.
3. Add payments with application logic and reversal with reason code.
4. Tune balances with FlowFields and compare with UniCore's SQL math.
5. Package UniCore exported CSV as a Config. Package and migrate it into BC.
6. Mirror the role model as `permissionset`s and walk through denied access cases.

Keep UniCore as the reference behaviour; implement and test the rules
**in Business Central**, and use SQLite data as your migration source.
