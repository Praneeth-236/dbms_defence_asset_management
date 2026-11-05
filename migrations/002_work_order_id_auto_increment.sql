/*
  Add database-generated work-order IDs for the existing create workflow.

  Review the live schema and take a verified backup before applying. This
  migration preserves existing work orders and events. It only changes the
  WorkOrderID generation strategy and temporarily recreates the existing
  MAINTENANCE_EVENT foreign key.
*/

USE defence_asset_system;

DROP PROCEDURE IF EXISTS apply_work_order_id_migration;
DELIMITER //

CREATE PROCEDURE apply_work_order_id_migration()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE v_rows BIGINT DEFAULT 0;
  DECLARE v_distinct_rows BIGINT DEFAULT 0;
  DECLARE v_max_id BIGINT DEFAULT 0;
  DECLARE v_next_id BIGINT DEFAULT 1;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database selected; expected defence_asset_system.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('MAINTENANCE_WORK_ORDER', 'MAINTENANCE_EVENT')
    AND TABLE_TYPE = 'BASE TABLE';
  IF v_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required work-order tables are missing.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MAINTENANCE_WORK_ORDER'
    AND COLUMN_NAME = 'WorkOrderID'
    AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO'
    AND COLUMN_KEY = 'PRI'
    AND EXTRA NOT LIKE '%auto_increment%';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WorkOrderID does not match the expected non-auto-increment INT primary key.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MAINTENANCE_EVENT'
    AND COLUMN_NAME = 'WorkOrderID'
    AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT.WorkOrderID differs from the expected INT NOT NULL column.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND k.TABLE_NAME = 'MAINTENANCE_EVENT'
    AND k.CONSTRAINT_NAME = 'maintenance_event_ibfk_1'
    AND k.COLUMN_NAME = 'WorkOrderID'
    AND k.REFERENCED_TABLE_NAME = 'MAINTENANCE_WORK_ORDER'
    AND k.REFERENCED_COLUMN_NAME = 'WorkOrderID'
    AND r.DELETE_RULE IN ('NO ACTION', 'RESTRICT')
    AND r.UPDATE_RULE IN ('NO ACTION', 'RESTRICT');
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected maintenance-event work-order foreign key or rules differ.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT WorkOrderID), COALESCE(MAX(WorkOrderID), 0)
    INTO v_rows, v_distinct_rows, v_max_id
  FROM MAINTENANCE_WORK_ORDER;
  IF v_rows <> v_distinct_rows THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Work-order IDs are not unique; migration stopped.';
  END IF;
  IF v_max_id >= 2147483647 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WorkOrderID has reached the INT limit; migration stopped.';
  END IF;
  SET v_next_id = v_max_id + 1;

  SELECT COUNT(*) INTO v_count
  FROM MAINTENANCE_EVENT e
  LEFT JOIN MAINTENANCE_WORK_ORDER w ON w.WorkOrderID = e.WorkOrderID
  WHERE w.WorkOrderID IS NULL;
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT contains orphan WorkOrderID values.';
  END IF;

  ALTER TABLE MAINTENANCE_EVENT DROP FOREIGN KEY maintenance_event_ibfk_1;

  SET @work_order_alter_sql = CONCAT(
    'ALTER TABLE MAINTENANCE_WORK_ORDER MODIFY COLUMN WorkOrderID INT NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = ',
    v_next_id
  );
  PREPARE work_order_alter FROM @work_order_alter_sql;
  EXECUTE work_order_alter;
  DEALLOCATE PREPARE work_order_alter;

  ALTER TABLE MAINTENANCE_EVENT
    ADD CONSTRAINT maintenance_event_ibfk_1
    FOREIGN KEY (WorkOrderID) REFERENCES MAINTENANCE_WORK_ORDER (WorkOrderID);

  SELECT 'WorkOrderID AUTO_INCREMENT migration applied' AS Result,
         v_rows AS PreservedWorkOrderRows,
         v_max_id AS ExistingMaximumWorkOrderID,
         v_next_id AS NextGeneratedWorkOrderID;
END//

DELIMITER ;

CALL apply_work_order_id_migration();
DROP PROCEDURE apply_work_order_id_migration;
