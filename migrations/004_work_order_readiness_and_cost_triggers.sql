/*
  Install the reviewed status/cost triggers. Take and verify a backup first.
  This migration does not update existing asset or maintenance-event rows.
  Review the read-only reconciliation preview below before a separately
  approved reconciliation; zero active orders does NOT automatically mean Ready.

  MySQL 8.0.46 restrictions: these triggers update ASSET, never the invoking
  MAINTENANCE_WORK_ORDER table. They read work-order rows in a separate SELECT.
  Concurrent work-order mutations can still race; these triggers do not promise
  globally serialized readiness consistency. FAILURE_EVENT has no resolution
  status, so unresolved failures are outside this rule.
  Run with stop-on-error enabled and do not use mysql --force. If the preflight
  CALL fails, the helper remains for inspection and no trigger DDL should run;
  after reviewing the error, remove only darms_preflight_work_order_readiness_20261104 before retry.
*/
USE defence_asset_system;

-- Read-only preflight preview: includes every asset, including those with zero
-- active orders. This query makes no status changes.
SELECT a.AssetID, a.AssetName, a.Status AS CurrentAssetStatus,
       COUNT(wo.WorkOrderID) AS ActiveWorkOrders
FROM ASSET AS a
LEFT JOIN MAINTENANCE_WORK_ORDER AS wo
  ON wo.AssetID = a.AssetID AND wo.Status IN ('Open', 'InProgress')
GROUP BY a.AssetID, a.AssetName, a.Status
ORDER BY a.AssetID;

-- Report legacy null costs; do not fabricate or update them.
SELECT COUNT(*) AS ExistingNullCostEvents
FROM MAINTENANCE_EVENT WHERE CostIncurred IS NULL;

DELIMITER //
CREATE PROCEDURE darms_preflight_work_order_readiness_20261104()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database; expected defence_asset_system.';
  END IF;
  IF VERSION() NOT LIKE '8.0.%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unexpected MySQL version; review this migration before applying.';
  END IF;
  SELECT COUNT(*) INTO v_count FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) IN ('ASSET', 'MAINTENANCE_WORK_ORDER', 'MAINTENANCE_EVENT')
    AND TABLE_TYPE = 'BASE TABLE' AND ENGINE = 'InnoDB';
  IF v_count <> 3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected InnoDB application tables are missing or differ.'; END IF;
  SELECT COUNT(*) INTO v_count FROM information_schema.TRIGGERS
  WHERE TRIGGER_SCHEMA = DATABASE() AND (
    (UPPER(TRIGGER_NAME) = 'TRG_ASSET_REPAIR_STATUS' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_EVENT' AND UPPER(EVENT_MANIPULATION) = 'INSERT' AND UPPER(ACTION_TIMING) = 'AFTER')) OR
    (UPPER(TRIGGER_NAME) = 'TRG_WORK_ORDER_ASSET_UNAVAILABLE_AFTER_INSERT' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_WORK_ORDER' AND UPPER(EVENT_MANIPULATION) = 'INSERT' AND UPPER(ACTION_TIMING) = 'AFTER')) OR
    (UPPER(TRIGGER_NAME) = 'TRG_WORK_ORDER_ASSET_STATUS_AFTER_UPDATE' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_WORK_ORDER' AND UPPER(EVENT_MANIPULATION) = 'UPDATE' AND UPPER(ACTION_TIMING) = 'AFTER')) OR
    (UPPER(TRIGGER_NAME) = 'TRG_WORK_ORDER_ASSET_STATUS_AFTER_DELETE' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_WORK_ORDER' AND UPPER(EVENT_MANIPULATION) = 'DELETE' AND UPPER(ACTION_TIMING) = 'AFTER')) OR
    (UPPER(TRIGGER_NAME) = 'TRG_MAINTENANCE_EVENT_REQUIRE_COST_BEFORE_INSERT' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_EVENT' AND UPPER(EVENT_MANIPULATION) = 'INSERT' AND UPPER(ACTION_TIMING) = 'BEFORE')) OR
    (UPPER(TRIGGER_NAME) = 'TRG_MAINTENANCE_EVENT_REQUIRE_COST_BEFORE_UPDATE' AND NOT (UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_EVENT' AND UPPER(EVENT_MANIPULATION) = 'UPDATE' AND UPPER(ACTION_TIMING) = 'BEFORE'))
  );
  IF v_count <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A reserved trigger name is attached to an unexpected table or event; stop and inspect it.'; END IF;
  SELECT COUNT(*) INTO v_count FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND (
    (UPPER(TABLE_NAME) = 'ASSET' AND UPPER(COLUMN_NAME) = 'ASSETID' AND UPPER(DATA_TYPE) = 'INT' AND UPPER(COLUMN_TYPE) = 'INT' AND UPPER(COLUMN_KEY) = 'PRI') OR
    (UPPER(TABLE_NAME) = 'ASSET' AND UPPER(COLUMN_NAME) = 'STATUS' AND UPPER(DATA_TYPE) IN ('VARCHAR', 'CHAR')) OR
    (UPPER(TABLE_NAME) = 'MAINTENANCE_WORK_ORDER' AND UPPER(COLUMN_NAME) = 'WORKORDERID' AND UPPER(DATA_TYPE) = 'INT' AND UPPER(COLUMN_TYPE) = 'INT' AND UPPER(COLUMN_KEY) = 'PRI') OR
    (UPPER(TABLE_NAME) = 'MAINTENANCE_WORK_ORDER' AND UPPER(COLUMN_NAME) = 'ASSETID' AND UPPER(DATA_TYPE) = 'INT' AND UPPER(COLUMN_TYPE) = 'INT' AND UPPER(IS_NULLABLE) = 'NO') OR
    (UPPER(TABLE_NAME) = 'MAINTENANCE_WORK_ORDER' AND UPPER(COLUMN_NAME) = 'STATUS' AND UPPER(DATA_TYPE) IN ('VARCHAR', 'CHAR')) OR
    (UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT' AND UPPER(COLUMN_NAME) = 'COSTINCURRED' AND UPPER(DATA_TYPE) = 'DECIMAL' AND NUMERIC_PRECISION = 15 AND NUMERIC_SCALE = 2 AND UPPER(IS_NULLABLE) = 'YES')
  );
  IF v_count <> 6 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application columns differ from the reviewed schema.'; END IF;
END//
DELIMITER ;
CALL darms_preflight_work_order_readiness_20261104();
DROP PROCEDURE darms_preflight_work_order_readiness_20261104;

DROP TRIGGER IF EXISTS trg_asset_repair_status;
DROP TRIGGER IF EXISTS trg_work_order_asset_unavailable_after_insert;
DROP TRIGGER IF EXISTS trg_work_order_asset_status_after_update;
DROP TRIGGER IF EXISTS trg_work_order_asset_status_after_delete;
DROP TRIGGER IF EXISTS trg_maintenance_event_require_cost_before_insert;
DROP TRIGGER IF EXISTS trg_maintenance_event_require_cost_before_update;

DELIMITER //
CREATE TRIGGER trg_work_order_asset_unavailable_after_insert
AFTER INSERT ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  IF NEW.Status IN ('Open', 'InProgress') THEN
    UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
  END IF;
END//

CREATE TRIGGER trg_work_order_asset_status_after_update
AFTER UPDATE ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  DECLARE v_active_orders BIGINT DEFAULT 0;
  IF NOT (OLD.AssetID <=> NEW.AssetID) THEN
    IF OLD.Status IN ('Open', 'InProgress') THEN
      SELECT COUNT(*) INTO v_active_orders FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = OLD.AssetID AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = OLD.AssetID;
    END IF;
    IF NEW.Status IN ('Open', 'InProgress') THEN
      UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
    ELSEIF NOT (OLD.Status <=> NEW.Status) AND NEW.Status IN ('Completed', 'Closed') THEN
      SELECT COUNT(*) INTO v_active_orders FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = NEW.AssetID AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = NEW.AssetID;
    END IF;
  ELSEIF NOT (OLD.Status <=> NEW.Status) THEN
    IF NEW.Status IN ('Open', 'InProgress') THEN
      UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
    ELSEIF NEW.Status IN ('Completed', 'Closed') THEN
      SELECT COUNT(*) INTO v_active_orders FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = NEW.AssetID AND WorkOrderID <> NEW.WorkOrderID
        AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = NEW.AssetID;
    END IF;
  END IF;
END//

CREATE TRIGGER trg_work_order_asset_status_after_delete
AFTER DELETE ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  DECLARE v_active_orders BIGINT DEFAULT 0;
  IF OLD.Status IN ('Open', 'InProgress') THEN
    SELECT COUNT(*) INTO v_active_orders FROM MAINTENANCE_WORK_ORDER
    WHERE AssetID = OLD.AssetID AND Status IN ('Open', 'InProgress');
    UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
    WHERE AssetID = OLD.AssetID;
  END IF;
END//

CREATE TRIGGER trg_maintenance_event_require_cost_before_insert
BEFORE INSERT ON MAINTENANCE_EVENT
FOR EACH ROW
BEGIN
  IF NEW.CostIncurred IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred is required for a new maintenance event.';
  END IF;
END//

CREATE TRIGGER trg_maintenance_event_require_cost_before_update
BEFORE UPDATE ON MAINTENANCE_EVENT
FOR EACH ROW
BEGIN
  IF NEW.CostIncurred IS NULL AND OLD.CostIncurred IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred cannot be set to NULL.';
  END IF;
END//
DELIMITER ;
