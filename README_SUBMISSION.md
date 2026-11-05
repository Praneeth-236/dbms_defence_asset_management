# Defence Asset Readiness & Maintenance Dependency System

## Submission package

This package preserves the existing MySQL schema and data. It does not
recreate the schema or execute SQL automatically.

| File | Purpose |
|---|---|
| `Dump20261101.sql` | Original database export; do not run against the live database |
| `PES2UG24CS902_PES2UG24CS652_5K_DBMS_REVIEW2_DATA_CORRECTED.sql` | Repeat-safe seed/data insertion script |
| `submission/00_schema_verification.sql` | Read-only schema and object inspection |
| `submission/01_unit1_relational_queries.sql` | Relational operations, joins, aggregates, grouping, and set operation |
| `submission/02_unit2_sql_queries.sql` | Nested/correlated queries, view, CTE, window function, and EXPLAIN |
| `submission/03_existing_programmable_features.sql` | Verification of the view, function, procedure, and reviewed trigger state |
| `submission/04_unit4_transaction_concurrency.sql` | Rollback-safe transaction and locking demonstrations |
| `submission/05_verification_tests.sql` | Read-only integrity and result checks |
| `submission/06_read_only_evidence_checklist.sql` | Read-only Workbench evidence queries |
| `submission/07_asset_creation_tests.sql` | Rollback-safe generated-ID and foreign-key creation checks |
| `migrations/001_asset_id_auto_increment.sql` | Preserves existing assets and enables MySQL-generated AssetID values |
| `migrations/002_work_order_id_auto_increment.sql` | Preserves existing work orders/events and enables MySQL-generated WorkOrderID values |
| `migrations/003_maintenance_event_id_auto_increment.sql` | Guarded, separate MaintenanceID generation migration |
| `migrations/004_work_order_readiness_and_cost_triggers.sql` | Guarded readiness/cost triggers and read-only reconciliation preview |
| `migrations/007_nonnegative_maintenance_cost.sql` | Guarded non-negative maintenance-cost CHECK constraint |
| `migrations/007_nonnegative_maintenance_cost_rollback.sql` | Reversible removal of only the named cost CHECK |
| `docs/ERD.md` | Mermaid ER diagram derived from the exported schema |
| `docs/normalization_and_design.md` | Unit 3 functional-dependency and normalization analysis |

## Team responsibilities

Complete this section with the approved team details before submission:

| Member | Responsibilities |
|---|---|
| `[Member 1 name]` | `[Assigned responsibilities]` |
| `[Member 2 name]` | `[Assigned responsibilities]` |

The project ER diagram is available in [`docs/ERD.md`](docs/ERD.md).
The application demo sequence is in
[`docs/LIVE_DEMO_SCRIPT.md`](docs/LIVE_DEMO_SCRIPT.md), and the current
requirements status is in
[`docs/FINAL_REQUIREMENTS_CHECKLIST.md`](docs/FINAL_REQUIREMENTS_CHECKLIST.md).

Fill in `[Member 1 name]`, `[Member 2 name]`, and each corresponding
`[Assigned responsibilities]` value with the actual team details before
submission. Do not leave the placeholders in the final report.

## Verified schema

The export contains 18 base tables:

`ASSET`, `ASSET_TYPE`, `COMPONENT`, `COMPONENT_DEPENDENCY`,
`COMPONENT_SPARE`, `COUNTRY`, `DEFENCE_INDICATOR`, `FAILURE_EVENT`,
`INSPECTION`, `MAINTENANCE_EVENT`, `MAINTENANCE_WORK_ORDER`, `SERVICE`,
`SPARE_PART`, `SUBSYSTEM`, `SUPPLIER`, `SUPPLIER_SPARE`, `UNIT`, and `USER`.

The original export contains the view, stored function, stored procedure, and
the unsafe `trg_asset_repair_status` trigger. The updated Part 16 SQL and
migration 004 remove that behavior and install the reviewed work-order status
and required-cost checks. Readiness cannot account for unresolved failures.

## Recommended Workbench order

1. Review the export and do not execute it against the live database.
2. Review and, if needed, execute the corrected data script.
3. Execute `submission/00_schema_verification.sql`.
4. Review and back up before separately applying migration 003, if the live
   `MAINTENANCE_EVENT.MaintenanceID` matches its preflight. Stop on any mismatch.
5. Review migration 004's read-only all-assets preview and historical NULL-cost
   count, then separately approve/apply it. It does not reconcile asset status
   or alter historical costs.
6. Review migration 007's negative-cost report. Resolve any reported historical
   negative costs only through an approved audit correction, then separately
   approve/apply the forward migration. It stops when negative costs remain;
   never replace them with zero. Verify the enforced CHECK in
   `information_schema.TABLE_CONSTRAINTS` and `CHECK_CONSTRAINTS`.
7. Execute `submission/01_unit1_relational_queries.sql`.
8. Execute `submission/02_unit2_sql_queries.sql`.
9. Execute `submission/03_existing_programmable_features.sql`.
10. Review `submission/04_unit4_transaction_concurrency.sql`; execute only
   the rollback-safe sections manually. The transaction requires the intended
   seed rows 1101, 701, and 103; the export itself contains schema only.
11. Execute `submission/05_verification_tests.sql`.
12. Include result grids and screenshots in the final report.

## Important safety notes

- Do not execute `Dump20261101.sql` on the existing database: it contains
  `DROP TABLE` statements.
- Do not execute the original Review 2 SQL as one batch: it updates and
  deletes project data and recreates programmable objects.
- No schema or data-changing SQL was executed against the live database.
  Trigger/migration integration checks used only a disposable MySQL 8.0.46
  instance loaded from checked-in schema and seed files. A read-only inspection
  found a negative historical maintenance cost; migration 007 must remain
  unapplied until the record is reviewed, any correction is explicitly
  approved and auditable, and its preflight passes.
- Migration 003 alters only the MaintenanceID column after schema and ID checks.
- Migration 004 installs triggers after schema preflight. It reports historical
  NULL costs and previews every asset's active-order count without changing rows.
- Migration `002_work_order_id_auto_increment.sql` is required only if the live
  schema matches the export's non-generated `WorkOrderID`. Verify the live
  schema and take a restorable backup before reviewing/applying it; MySQL DDL
  is not rolled back as a unit.
- `Dump20261101.sql` contains no `INSERT INTO` statements, so it cannot prove
  that any data row exists. IDs 1101 and 701 originate from the corrected
  seed script, not from the export.
- The existing schema has limited domain constraints; this limitation is
  documented rather than silently changing the schema.

## Unit coverage

- Unit 1: relational operations, keys/relationships from the export,
  aggregates, grouping, joins, and set operations.
- Unit 2: SQL queries, nested/correlated subqueries, views, stored
  function/procedure, trigger verification, CTE, window function, and EXPLAIN.
- Unit 3: functional dependencies, normal forms, decomposition, and
  dependency preservation analysis.
- Unit 4: transactions, rollback/recovery, row locking, and security guidance.

No separate NoSQL system is added because the verified implementation and
database are MySQL-based and the existing schema is sufficient for the
approved project scope.
