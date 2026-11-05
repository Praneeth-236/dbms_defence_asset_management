/*
  Separate, guarded MaintenanceID generation change.
  Take and verify a database backup first. This migration writes no event data.
  Stop if the target schema, current column definition, identifiers, or table
  engine differ from the reviewed dump. Never replace IDs or use MAX(id)+1 in
  application code; MySQL chooses the next value after this ALTER.
  Run with stop-on-error enabled and do not use mysql --force. If a preflight
  CALL fails, the helper routine remains for inspection; after reviewing the
  error, remove only darms_preflight_maintenance_event_id_20261104 before retry.
*/
USE defence_asset_system;
DELIMITER //
CREATE PROCEDURE darms_preflight_maintenance_event_id_20261104()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE v_rows BIGINT DEFAULT 0;
  DECLARE v_distinct BIGINT DEFAULT 0;
  DECLARE v_max BIGINT DEFAULT 0;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database; expected defence_asset_system.';
  END IF;
  IF VERSION() NOT LIKE '8.0.%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unexpected MySQL version; review this migration before applying.';
  END IF;
  SELECT COUNT(*) INTO v_count FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MAINTENANCE_EVENT'
    AND TABLE_TYPE = 'BASE TABLE' AND ENGINE = 'InnoDB';
  IF v_count <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT must exist as an InnoDB table.'; END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MAINTENANCE_EVENT'
    AND COLUMN_NAME = 'MaintenanceID' AND DATA_TYPE = 'int'
    AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI'
    AND EXTRA NOT LIKE '%auto_increment%';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MaintenanceID does not match the expected signed INT, NOT NULL primary key without AUTO_INCREMENT.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MAINTENANCE_EVENT'
    AND COLUMN_NAME = 'CostIncurred' AND DATA_TYPE = 'decimal'
    AND NUMERIC_PRECISION = 15 AND NUMERIC_SCALE = 2 AND IS_NULLABLE = 'YES';
  IF v_count <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred schema differs from expected nullable DECIMAL(15,2).'; END IF;

  SELECT COUNT(*), COUNT(DISTINCT MaintenanceID), COALESCE(MAX(MaintenanceID), 0)
    INTO v_rows, v_distinct, v_max FROM MAINTENANCE_EVENT;
  IF v_rows <> v_distinct THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MaintenanceID values are not unique.'; END IF;
  IF v_max >= 2147483647 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MaintenanceID has reached the signed INT limit.'; END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME = 'MAINTENANCE_EVENT'
    AND REFERENCED_COLUMN_NAME = 'MaintenanceID';
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Other tables reference MaintenanceID; review dependent foreign keys before applying.';
  END IF;

  ALTER TABLE MAINTENANCE_EVENT
    MODIFY COLUMN MaintenanceID INT NOT NULL AUTO_INCREMENT;
  SELECT 'MaintenanceID AUTO_INCREMENT enabled' AS Result,
         v_rows AS PreservedEventRows, v_max AS ExistingMaximumMaintenanceID;
END//
DELIMITER ;
CALL darms_preflight_maintenance_event_id_20261104();
DROP PROCEDURE darms_preflight_maintenance_event_id_20261104;
