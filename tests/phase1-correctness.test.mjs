import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateStockAdjustment,
  displayMaintenanceCost,
  displayReorderLevel,
  displayStockQuantity,
  displayWorkOrderStatus,
  isForeignKeyRestriction
} from "../lib/inventory-values.mjs";
import { isDecimal15Scale2 } from "../lib/maintenance-cost.mjs";
import { isDateTimeLocal, isDecimal10Scale2, toMySqlDateTime } from "../lib/maintenance-event-values.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("stock adjustments reject unknown stock without assuming zero", () => {
  assert.deepEqual(calculateStockAdjustment(null, 5), { ok: false, reason: "STOCK_UNSPECIFIED" });
  assert.deepEqual(calculateStockAdjustment(null, -1), { ok: false, reason: "STOCK_UNSPECIFIED" });
});

test("stock adjustments reject over-consumption and preserve valid balances", () => {
  assert.deepEqual(calculateStockAdjustment(3, -4), { ok: false, reason: "INSUFFICIENT_STOCK" });
  assert.deepEqual(calculateStockAdjustment(3, -3), { ok: true, stockQuantity: 0 });
  assert.deepEqual(calculateStockAdjustment(3, 2), { ok: true, stockQuantity: 5 });
  assert.deepEqual(calculateStockAdjustment(-1, 1), { ok: false, reason: "INVALID_STOCK" });
});

test("nullable stock, reorder, cost, and work-order values have explicit labels", () => {
  assert.equal(displayStockQuantity(null), "Unspecified");
  assert.equal(displayReorderLevel(null), "Unspecified");
  assert.equal(displayMaintenanceCost(null), "No cost recorded");
  assert.equal(displayWorkOrderStatus(null), "Unspecified");
  assert.equal(displayStockQuantity(0), 0);
  assert.equal(displayMaintenanceCost(0), 0);
});

test("inventory UI and cost report use the explicit nullable labels", async () => {
  const inventory = await read("../app/inventory/inventory-manager.tsx");
  const report = await read("../app/reports/page.tsx");
  assert.match(inventory, /displayStockQuantity\(part\.StockQuantity\)/);
  assert.match(inventory, /displayReorderLevel\(part\.ReorderLevel\)/);
  assert.match(report, /displayMaintenanceCost\(row\.TotalCost\)/);
  assert.doesNotMatch(inventory, /part\.StockQuantity \?\? 0/);
  assert.doesNotMatch(inventory, /part\.ReorderLevel \?\? 0/);
  assert.doesNotMatch(report, /row\.TotalCost \?\? 0/);
});

test("foreign-key restriction codes are recognized", () => {
  assert.equal(isForeignKeyRestriction({ errno: 1451 }), true);
  assert.equal(isForeignKeyRestriction({ code: "ER_ROW_IS_REFERENCED_2" }), true);
  assert.equal(isForeignKeyRestriction({ errno: 1062 }), false);
});

test("inventory API locks the stock row and does not clamp underflow", async () => {
  const source = await read("../app/api/inventory/[id]/route.ts");
  assert.match(source, /withTransaction\(async \(connection\)/);
  assert.match(source, /SELECT StockQuantity FROM SPARE_PART WHERE SparePartID = \? FOR UPDATE/);
  assert.doesNotMatch(source, /GREATEST\s*\(/i);
  assert.match(source, /STOCK_UNSPECIFIED/);
  assert.match(source, /INSUFFICIENT_STOCK/);
});

test("work-order form captures its element before awaiting", async () => {
  const source = await read("../app/work-orders/new-work-order-form.tsx");
  const capture = source.indexOf("const form = event.currentTarget;");
  const request = source.indexOf("await fetch(");
  assert.ok(capture >= 0 && capture < request);
  assert.match(source, /form\.reset\(\)/);
  assert.doesNotMatch(source.slice(request), /event\.currentTarget/);
});

test("work-order operator control does not default a null status to Open", async () => {
  const source = await read("../app/work-orders/work-order-manager.tsx");
  assert.match(source, /value=\{order\.Status \?\? ""\}/);
  assert.match(source, /displayWorkOrderStatus\(order\.Status\)/);
  assert.doesNotMatch(source, /value=\{order\.Status \?\? "Open"\}/);
});

test("asset deletion maps foreign-key restrictions to HTTP 409", async () => {
  const source = await read("../app/api/assets/[id]/route.ts");
  assert.match(source, /if \(isForeignKeyRestriction\(error\)\)[\s\S]*?status: 409/);
});

test("work-order triggers handle active insert, status transitions, reassignment, and active deletion", async () => {
  const migration = await read("../../migrations/004_work_order_readiness_and_cost_triggers.sql");
  assert.match(migration, /AFTER INSERT ON MAINTENANCE_WORK_ORDER/);
  assert.match(migration, /OLD\.AssetID <=> NEW\.AssetID/);
  assert.match(migration, /AFTER DELETE ON MAINTENANCE_WORK_ORDER/);
  assert.match(migration, /DROP TRIGGER IF EXISTS trg_asset_repair_status/);
  assert.doesNotMatch(migration, /CREATE TRIGGER trg_asset_repair_status/i);
  assert.match(migration, /FAILURE_EVENT has no resolution\s+status/);
  assert.match(migration, /LEFT JOIN MAINTENANCE_WORK_ORDER/);
  assert.match(migration, /ExistingNullCostEvents/);
  assert.match(migration, /NEW\.CostIncurred IS NULL AND OLD\.CostIncurred IS NOT NULL/);
  assert.match(migration, /reserved trigger name is attached to an unexpected table or event/);
});

test("maintenance costs are required, validated, parameterized, and IDs stay a separate migration", async () => {
  const validation = await read("../lib/validation.ts");
  const api = await read("../app/api/maintenance-events/route.ts");
  const form = await read("../app/work-orders/[id]/maintenance-event-form.tsx");
  const idMigration = await read("../../migrations/003_maintenance_event_id_auto_increment.sql");
  assert.match(validation, /decimal15Scale2/);
  assert.match(validation, /maintenanceEventSchema/);
  assert.match(api, /CostIncurred, StartDateTime, EndDateTime, DowntimeHours\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.match(api, /parsed\.data\.costIncurred/);
  assert.match(api, /result\.insertId/);
  assert.match(api, /errno === 1644[\s\S]*?status: 400/);
  assert.match(form, /name="costIncurred"[^>]*required/);
  assert.match(idMigration, /information_schema\.COLUMNS/);
  assert.match(idMigration, /COLUMN_TYPE = 'int'/);
  assert.match(idMigration, /MAX\(MaintenanceID\)/);
  assert.doesNotMatch(idMigration, /COALESCE\(MAX\(MaintenanceID\),\s*0\)\s*\+/i);
  const setup = await read("../../Documents/PES2UG24CS902_PES2UG24CS652_5K_DBMS_REVIEW2.sql");
  assert.doesNotMatch(setup, /CREATE TRIGGER trg_asset_repair_status/i);
  assert.match(setup, /trg_maintenance_event_require_cost_before_update/);
});

test("DECIMAL(15,2) cost validator rejects negatives, malformed, over-precision, and overflow values", () => {
  for (const value of [undefined, null, "", "-0.01", "-9999999999999.99", "12,34", "12.345", "10000000000000.00", "00000000000000.00", 1.25]) {
    assert.equal(isDecimal15Scale2(value), false, `expected rejection for ${String(value)}`);
  }
  for (const value of ["0", "0.00", "1", "12.3", "12.34", "9999999999999.99"]) {
    assert.equal(isDecimal15Scale2(value), true, `expected acceptance for ${value}`);
  }
});

test("maintenance cost form, API validation, and reversible CHECK migration reject negatives before writes", async () => {
  const form = await read("../app/work-orders/[id]/maintenance-event-form.tsx");
  const validation = await read("../lib/validation.ts");
  const api = await read("../app/api/maintenance-events/route.ts");
  const up = await read("../../migrations/007_nonnegative_maintenance_cost.sql");
  const down = await read("../../migrations/007_nonnegative_maintenance_cost_rollback.sql");
  assert.match(form, /pattern="\[0-9\]\+\(\\\.\[0-9\]\{1,2\}\)\?"/);
  const costInput = form.match(/<input name="costIncurred"[^>]*>/)?.[0] ?? "";
  assert.ok(costInput, "maintenance cost input exists");
  assert.doesNotMatch(costInput, /pattern="-\?/);
  assert.match(validation, /zero or a positive value/);
  const parseAt = api.indexOf("maintenanceEventSchema.safeParse");
  const writeAt = api.indexOf("await execute(");
  assert.ok(parseAt >= 0 && parseAt < writeAt, "validation must happen before the INSERT");
  assert.match(api, /errno === 3819[\s\S]*?status: 400/);
  assert.match(up, /SELECT MaintenanceID, CostIncurred[\s\S]*WHERE CostIncurred < 0/i);
  assert.match(up, /Negative historical CostIncurred values exist/);
  assert.match(up, /primary key differs from the reviewed MaintenanceID key/);
  assert.match(up, /foreign keys differ from the reviewed schema/);
  assert.match(up, /ACTION_STATEMENT/);
  assert.match(up, /CHECK \(CostIncurred >= 0\) ENFORCED/i);
  assert.match(up, /TABLE_CONSTRAINTS AS tc[\s\S]*CHECK_CONSTRAINTS AS cc/i);
  assert.match(up, /tc\.ENFORCED/i);
  assert.match(down, /Expected enforced CostIncurred >= 0 CHECK was not found/);
  assert.match(down, /TABLE_CONSTRAINTS AS tc[\s\S]*CHECK_CONSTRAINTS AS cc/i);
  assert.match(down, /tc\.ENFORCED/i);
  assert.match(down, /DROP CHECK chk_maintenance_event_cost_nonnegative/);
});

test("optional maintenance dates and downtime retain their existing validation", () => {
  assert.equal(isDateTimeLocal("2025-02-28T23:59"), true);
  assert.equal(isDateTimeLocal("2025-02-29T23:59"), false);
  assert.equal(isDateTimeLocal("2025-01-01T24:00"), false);
  assert.equal(toMySqlDateTime("2025-02-28T23:59"), "2025-02-28 23:59:00");
  assert.equal(isDecimal10Scale2("-12.50"), true);
  assert.equal(isDecimal10Scale2("99999999.99"), true);
  assert.equal(isDecimal10Scale2("100000000.00"), false);
  assert.equal(isDecimal10Scale2("12.345"), false);
});

test("maintenance event UI and API record optional dates and downtime as parameterized values", async () => {
  const form = await read("../app/work-orders/[id]/maintenance-event-form.tsx");
  const route = await read("../app/api/maintenance-events/route.ts");
  const assetDetail = await read("../app/assets/[id]/page.tsx");
  assert.match(form, /name="startDateTime" type="datetime-local"/);
  assert.match(form, /name="endDateTime" type="datetime-local"/);
  assert.match(form, /name="downtimeHours"/);
  assert.match(form, /name="costIncurred"[^>]*required/);
  assert.match(route, /StartDateTime, EndDateTime, DowntimeHours\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.match(route, /parsed\.data\.startDateTime[\s\S]*parsed\.data\.downtimeHours/);
  assert.match(assetDetail, /Maintenance history/);
  assert.match(assetDetail, /formatDateTime\(event\.StartDateTime/);
  assert.match(assetDetail, /event\.DowntimeHours/);
  assert.match(assetDetail, /canRecordMaintenance \? "Record event" : "View events"/);
});

test("asset hierarchy exposes expandable supported records and Admin-only mutation routes", async () => {
  const manager = await read("../app/assets/[id]/asset-hierarchy-manager.tsx");
  const detail = await read("../app/assets/[id]/page.tsx");
  const subsystemRoute = await read("../app/api/subsystems/[id]/route.ts");
  const componentRoute = await read("../app/api/components/[id]/route.ts");
  const createSubsystem = await read("../app/api/subsystems/route.ts");
  const createComponent = await read("../app/api/components/route.ts");
  const validation = await read("../lib/validation.ts");
  const migration = await read("../../migrations/006_component_hierarchy_id_auto_increment.sql");
  assert.match(detail, /<h2>Components<\/h2>/);
  assert.match(detail, /idGenerationReady/);
  assert.match(detail, /SELECT c\.ComponentID[\s\S]*JOIN SUBSYSTEM ss ON ss\.SubsystemID = c\.SubsystemID WHERE ss\.AssetID = \?/);
  assert.match(manager, /<details className="hierarchy-node"/);
  assert.match(manager, /hierarchy-child/);
  assert.match(manager, /window\.confirm/);
  assert.match(manager, /useRef\(false\)/);
  assert.match(manager, /if \(inFlight\.current\) return/);
  assert.match(manager, /role=\{notice\.error \? "alert" : "status"\}/);
  assert.match(manager, /component-to-component parent relationship/);
  assert.match(manager, /ID_GENERATION_NOT_CONFIGURED|idGenerationReady/);
  assert.match(manager, /Edit subsystem/);
  assert.match(manager, /Edit component/);
  assert.match(manager, /Add component/);
  assert.match(manager, /Add subsystem/);
  for (const route of [subsystemRoute, componentRoute]) {
    assert.match(route, /hasRole\(session, \["Admin"\]\)/);
    assert.match(route, /UPDATE (SUBSYSTEM|COMPONENT) SET/);
    assert.match(route, /DELETE FROM (SUBSYSTEM|COMPONENT)/);
    assert.match(route, /isForeignKeyRestriction\(error\)/);
    assert.match(route, /status: 409/);
  }
  for (const route of [createSubsystem, createComponent]) {
    assert.match(route, /export async function POST/);
    assert.match(route, /hasRole\(session, \["Admin"\]\)/);
    assert.match(route, /withTransaction\(/);
    assert.match(route, /information_schema\.COLUMNS/);
    assert.match(route, /auto_increment/);
    assert.match(route, /INSERT INTO (SUBSYSTEM|COMPONENT).*VALUES \(\?,/s);
    assert.match(route, /result\.insertId/);
    assert.doesNotMatch(route, /MAX\s*\(/i);
  }
  assert.match(validation, /subsystemCreateSchema/);
  assert.match(validation, /componentCreateSchema/);
  assert.match(validation, /subsystemName: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\)/);
  assert.match(validation, /componentName: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\)/);
  assert.match(migration, /ALTER TABLE SUBSYSTEM MODIFY COLUMN SubsystemID INT NOT NULL AUTO_INCREMENT/);
  assert.match(migration, /ALTER TABLE COMPONENT MODIFY COLUMN ComponentID INT NOT NULL AUTO_INCREMENT/);
  assert.match(migration, /DROP FOREIGN KEY component_dependency_ibfk_1/);
  assert.match(migration, /ADD CONSTRAINT component_dependency_ibfk_1[\s\S]*ON DELETE NO ACTION ON UPDATE NO ACTION/);
  assert.match(migration, /DECLARE EXIT HANDLER FOR SQLEXCEPTION/);
  assert.match(migration, /preserves existing IDs/i);
  assert.match(migration, /Unexpected inbound references to SUBSYSTEM\.SubsystemID/);
  assert.match(migration, /Unexpected inbound references to COMPONENT\.ComponentID/);
});

test("work order detail links to its asset and states component linkage is unsupported by schema", async () => {
  const detail = await read("../app/work-orders/[id]/page.tsx");
  const schema = await read("../../Documents/Dump20261101.sql");
  assert.match(detail, /assets\/\$\{order\.AssetID\}/);
  assert.match(detail, /Component association is not stored/);
  assert.match(schema, /CREATE TABLE `maintenance_work_order` \([\s\S]*`AssetID` int NOT NULL,[\s\S]*`Status` varchar\(30\) DEFAULT NULL,[\s\S]*PRIMARY KEY \(`WorkOrderID`\)/);
  assert.doesNotMatch(schema.match(/CREATE TABLE `maintenance_work_order` \([\s\S]*?\);/)?.[0] ?? "", /ComponentID/);
});

test("work-order page exposes existing edit controls and labels deletion accurately", async () => {
  const manager = await read("../app/work-orders/work-order-manager.tsx");
  const detail = await read("../app/work-orders/[id]/page.tsx");
  assert.match(manager, /Edit description/);
  assert.match(manager, /name="priority"/);
  assert.match(manager, /Delete work order/);
  assert.doesNotMatch(manager, />Cancel</);
  assert.match(manager, /Record event/);
  assert.match(detail, /id="record-maintenance-event"/);
});

test("asset status is labeled as recorded status and readiness calculation remains unchanged", async () => {
  const detail = await read("../app/assets/[id]/page.tsx");
  const dashboard = await read("../app/page.tsx");
  assert.match(detail, /Recorded asset status/);
  assert.match(dashboard, /Active work orders/);
  assert.doesNotMatch(dashboard, /Under maintenance · recorded status/);
});

test("failure recording validates schema-nullable event fields and real local date-times", async () => {
  const validation = await read("../lib/validation.ts");
  const values = await read("../lib/maintenance-event-values.mjs");
  assert.match(validation, /failureEventSchema = z\.object/);
  assert.match(validation, /assetId: z\.coerce\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(validation, /failureType: optionalNullableText\(100\)/);
  assert.match(validation, /severity: optionalNullableText\(20\)/);
  assert.match(validation, /occurredAt: optionalNullableDateTime/);
  assert.match(validation, /description: optionalNullableText\(500\)/);
  assert.match(values, /new Date\(Date\.UTC\(year, month - 1, day\)\)/);
});

test("failure POST is authenticated, parameterized, verifies generated IDs, and invalidates dashboard cache", async () => {
  const route = await read("../app/api/failures/route.ts");
  assert.match(route, /currentSession\(\)/);
  assert.match(route, /roleAllowed\(session\.role\)/);
  assert.match(route, /SELECT AssetID FROM ASSET WHERE AssetID = \? FOR SHARE/);
  assert.match(route, /INSERT INTO FAILURE_EVENT \(FailureType, Severity, OccurredAt, Description, AssetID\) VALUES \(\?, \?, \?, \?, \?\)/);
  assert.match(route, /parsed\.data\.failureType \?\? null/);
  assert.match(route, /parsed\.data\.occurredAt \?\? null/);
  assert.doesNotMatch(route, /MAX\s*\(\s*FailureID/i);
  assert.doesNotMatch(route, /INSERT INTO FAILURE_EVENT \(FailureID/);
  assert.match(route, /auto_increment/);
  assert.match(route, /result\.insertId/);
  assert.match(route, /errno === 1452/);
  assert.match(route, /FAILURE_ID_GENERATION_NOT_CONFIGURED/);
  assert.match(route, /invalidate\(\["failures"\]\)/);
  assert.match(route, /status: 201/);
});

test("failure form guards duplicate submits and reports success/errors while refreshing the list", async () => {
  const form = await read("../app/failures/failure-form.tsx");
  const page = await read("../app/failures/page.tsx");
  assert.match(form, /useRef\(false\)/);
  assert.match(form, /if \(inFlight\.current\) return/);
  assert.match(form, /inFlight\.current = true/);
  assert.match(form, /disabled=\{busy \|\| assets\.length === 0\}/);
  assert.match(form, /setMessage\(`Failure event \$\{result\.failureId\} recorded\.\`\)/);
  assert.match(form, /role=\{error \? "alert" : "status"\}/);
  assert.match(form, /router\.refresh\(\)/);
  for (const field of ["assetId", "failureType", "severity", "occurredAt", "description"]) {
    assert.match(form, new RegExp(`name="${field}"`));
  }
  assert.match(page, /SELECT AssetID, AssetName FROM ASSET/);
  assert.match(page, /FailureForm assets=\{assets\}/);
  assert.match(page, /roleAllowed\(\(await currentSession\(\)\)\?\.role\)/);
});
