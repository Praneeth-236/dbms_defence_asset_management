# Defence Asset Readiness & Maintenance Dependency System

## 1. Project scope

This project is a MySQL database system for analysing fictional defence-style
asset readiness, maintenance events, component dependencies, spare parts, and
suppliers. The data is synthetic and non-sensitive. The implementation uses
the existing `defence_asset_system` schema and does not add tables.

## 2. Verified database implementation

The database export contains 18 base tables:

- `COUNTRY`, `SERVICE`, `UNIT`
- `ASSET_TYPE`, `ASSET`, `SUBSYSTEM`, `COMPONENT`
- `COMPONENT_DEPENDENCY`, `SPARE_PART`, `COMPONENT_SPARE`
- `SUPPLIER`, `SUPPLIER_SPARE`
- `FAILURE_EVENT`, `INSPECTION`
- `MAINTENANCE_WORK_ORDER`, `MAINTENANCE_EVENT`
- `` `USER` ``

The export also contains the `asset_readiness_view` view, the legacy
`trg_asset_repair_status` trigger, the `get_failure_count` function, and the
`update_asset_status` procedure. The reviewed Part 16 and migration 004 remove
the unsafe Repair-to-Ready behavior and use work-order state only; this cannot
account for unresolved failures because failure records have no resolution
status.

## 3. Relational design

The schema ER diagram is available in
[ERD.md](./ERD.md). It is derived from the exported table definitions and
foreign keys.

## 4. Team responsibilities

Complete this section with the approved team details before submission:

| Member | Responsibilities |
|---|---|
| `[Member 1 name]` | `[Assigned responsibilities]` |
| `[Member 2 name]` | `[Assigned responsibilities]` |

Entity tables use single-column primary keys. Relationship tables use
composite primary keys:

- `COMPONENT_DEPENDENCY(ComponentID, DependsOnComponentID)`
- `COMPONENT_SPARE(ComponentID, SparePartID)`
- `SUPPLIER_SPARE(SupplierID, SparePartID)`

Foreign keys connect countries to services, services to units, units and
asset types to assets, assets to failures/work orders/subsystems, subsystems
to components, and components/spares/suppliers through relationship tables.
The complete normalization discussion is in
[normalization_and_design.md](./normalization_and_design.md).

## 5. Unit 1 coverage

The project demonstrates selection, projection, joins, set union, aggregate
functions, grouping, and `HAVING` using assets, units, services, and
maintenance events. The SQL-to-relational-algebra mapping is documented in
`submission/01_unit1_relational_queries.sql`.

## 6. Unit 2 coverage

The project demonstrates:

- basic queries and joins;
- nested and true correlated subqueries;
- `UNION`;
- the existing readiness view;
- the existing trigger, function, and procedure;
- CTE and window-function queries;
- `EXPLAIN` for query-plan inspection.

These are organized in
`submission/02_unit2_sql_queries.sql` and
`submission/03_existing_programmable_features.sql`.

## 7. Unit 3 coverage

The design analysis identifies representative functional dependencies,
candidate-key assumptions, 1NF/2NF/3NF status, BCNF assumptions, lossless
decomposition, and dependency preservation. It also records limitations:
many domain values are nullable or unconstrained because the approved schema
must be preserved.

## 8. Unit 4 coverage

The transaction script demonstrates a maintenance workflow that locks a spare
part, work order, and technician, consumes stock, records a maintenance event,
and then rolls back all effects together. It is conditional because the
schema-only export does not prove that the intended seed rows exist. No
`COMMIT`, `DELETE`, `DROP`, or `TRUNCATE` is included in the demonstration
script. A two-session concurrency procedure and security guidance for password
hashes, least privilege, parameterized SQL, encrypted connections, and
protected backups are documented in
`submission/04_unit4_transaction_concurrency.sql`.

## 9. Testing

`submission/05_verification_tests.sql` contains read-only checks for orphan
references, self-dependencies, duplicate relationship mappings, negative
stock, missing maintenance references, and primary-key uniqueness.

The SQL has not been executed by Codex. Result grids and screenshots must be
captured manually in MySQL Workbench for the final academic report.

## 10. Execution order

1. Review the original export; do not execute it against the live database.
2. Review and, if necessary, execute the corrected data script.
3. Execute `submission/00_schema_verification.sql`.
4. Execute `submission/01_unit1_relational_queries.sql`.
5. Execute `submission/02_unit2_sql_queries.sql`.
6. Execute `submission/03_existing_programmable_features.sql`.
7. Review and manually execute the rollback-safe portions of
   `submission/04_unit4_transaction_concurrency.sql`.
8. Execute `submission/05_verification_tests.sql`.

## 11. Known limitations

- The web application now provides signed HTTP-only sessions and server-side
  authorization for the `Admin` and `Analyst` roles. This role mapping is an
  explicit project assumption because the existing schema stores roles as
  free-text values and the project documents do not define a permission
  matrix.
- The existing seed file contains placeholder password values such as
  `hash_demo_101`, not usable password hashes. Before demonstrating login,
  provision approved users with PBKDF2 hashes in the supported format and set
  `AUTH_SESSION_SECRET` in the web application environment. Do not commit
  credentials.
- The existing schema has no broad domain `CHECK`/`UNIQUE` policy for status,
  severity, criticality, stock, dates, email, part number, or asset
  identification values.
- `Dump20261101.sql` contains schema and programmable-object definitions but
  no data INSERT statements. Therefore, `SparePartID` 1101 and
  `WorkOrderID` 701 are not verified as existing database rows by the export;
  they are intended seed-script IDs.
- The existing procedure changes asset data and should only be invoked after
  review in a disposable test database.
- Review 1 and Review 2 PDF contents were not used to invent requirements
  where their text could not be reliably extracted. The SQL export and
  project plan are the implementation evidence used here.
- No separate NoSQL database is added because the verified implementation is
  MySQL-based and the existing schema supports the approved project scope.
