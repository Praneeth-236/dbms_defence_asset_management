/*
  Unit 4: transaction, locking, recovery, concurrency, and security.

  The database export is schema-only and does not prove that IDs 1101, 701,
  or 103 currently exist. The corrected seed script supplies those intended
  demonstration records. The workflow below therefore performs work only
  when the required rows exist.

  This file is not executed by Codex. It contains no COMMIT, DELETE, DROP,
  or TRUNCATE. Every workflow ends with ROLLBACK.
*/

USE defence_asset_system;

/*
  Rollback-safe maintenance workflow (requires migration 003 for generated IDs):
  1. Lock the spare, work order, and technician rows.
  2. Consume two Fuel Pump Seals from spare stock.
  3. Supply a user-entered DECIMAL(15,2) in @user_entered_cost before running
     this section. There is deliberately no sample/default cost here.
  4. Record a repair maintenance event for the locked work order.
  5. Inspect the combined result. A Repair event does not establish readiness.
  6. Roll back stock, event, and trigger effects together.
*/
START TRANSACTION;

SELECT SparePartID, PartName, StockQuantity
FROM SPARE_PART
WHERE SparePartID = 1101
FOR UPDATE;

SELECT WorkOrderID, AssetID, Status
FROM MAINTENANCE_WORK_ORDER
WHERE WorkOrderID = 701
FOR UPDATE;

SELECT UserID, FullName, Role
FROM `USER`
WHERE UserID = 103
FOR UPDATE;

SET @stock_updated := 0;

UPDATE SPARE_PART
SET StockQuantity = StockQuantity - 2
WHERE SparePartID = 1101
  AND StockQuantity >= 2;

SET @stock_updated := ROW_COUNT();

INSERT INTO MAINTENANCE_EVENT
    (WorkOrderID, Remarks, PerformedBy,
     StartDateTime, EndDateTime, MaintenanceType, ActionTaken,
     DowntimeHours, CostIncurred)
SELECT
    701,
    'Rollback-safe cooling repair demonstration',
    103,
    '2026-09-24 09:00:00',
    '2026-09-24 11:00:00',
    'Repair',
    'Consumed two Fuel Pump Seals during repair workflow',
    2.00,
    @user_entered_cost
FROM MAINTENANCE_WORK_ORDER AS wo
JOIN `USER` AS u ON u.UserID = 103
WHERE wo.WorkOrderID = 701
  AND @stock_updated = 1;

SET @event_inserted := ROW_COUNT();
SET @demo_event_id := IF(@event_inserted = 1, LAST_INSERT_ID(), NULL);

-- Review the atomic state before undoing it.
SELECT sp.SparePartID, sp.StockQuantity,
       me.MaintenanceID, me.WorkOrderID, me.MaintenanceType
FROM SPARE_PART AS sp
LEFT JOIN MAINTENANCE_EVENT AS me
       ON me.MaintenanceID = @demo_event_id
WHERE sp.SparePartID = 1101;

ROLLBACK;

-- Expected after rollback: original stock and no demonstration event.
SELECT SparePartID, StockQuantity
FROM SPARE_PART
WHERE SparePartID = 1101;

SELECT MaintenanceID, WorkOrderID
FROM MAINTENANCE_EVENT
WHERE MaintenanceID = @demo_event_id;

/*
  Two-session concurrency demonstration

  Preconditions:
    - Run the corrected seed script first if the intended demo rows are absent.
    - Use two separate MySQL Workbench connections.

  SESSION A:
    START TRANSACTION;
    SELECT SparePartID, StockQuantity
    FROM SPARE_PART
    WHERE SparePartID = 1101
    FOR UPDATE;
    UPDATE SPARE_PART
    SET StockQuantity = StockQuantity - 2
    WHERE SparePartID = 1101
      AND StockQuantity >= 2;
    -- Keep Session A open; do not commit.

  SESSION B, while Session A is still open:
    START TRANSACTION;
    SELECT SparePartID, StockQuantity
    FROM SPARE_PART
    WHERE SparePartID = 1101
    FOR UPDATE;

  Expected result:
    - Session B waits because Session A owns the row lock.
    - Session A runs ROLLBACK.
    - Session B then returns the original stock quantity, not the
      uncommitted quantity from Session A.
    - Session B runs ROLLBACK.

  This demonstrates pessimistic row locking and prevents two concurrent
  maintenance workflows from consuming the same stock simultaneously.
*/

/*
  Security checklist:
  - use a least-privilege MySQL account;
  - keep credentials outside SQL files;
  - store only password hashes in USER.PasswordHash;
  - use prepared/parameterized statements in application code;
  - never concatenate user input into SQL;
  - use encrypted connections and protected backups where configured.
*/
