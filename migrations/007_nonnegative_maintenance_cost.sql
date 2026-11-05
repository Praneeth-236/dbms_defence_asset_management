/*
  Reject negative maintenance costs without changing the nullable DECIMAL
  column, existing triggers, keys, or historical rows.

  The preflight reports and refuses to proceed while any negative costs exist.
  Resolve those records through an approved, auditable business correction
  before applying this migration. MySQL 8.0.16+ enforces CHECK constraints;
  this migration is intentionally pinned to the project's verified 8.0.46.
*/
USE defence_asset_system;

SELECT MaintenanceID, CostIncurred
FROM maintenance_event
WHERE CostIncurred < 0
ORDER BY MaintenanceID;

DROP PROCEDURE IF EXISTS darms_preflight_nonnegative_maintenance_cost_20261105;
DELIMITER //
CREATE PROCEDURE darms_preflight_nonnegative_maintenance_cost_20261105()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE v_primary_columns BIGINT DEFAULT 0;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database; expected defence_asset_system.';
  END IF;
  IF VERSION() NOT LIKE '8.0.46%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unexpected MySQL version; CHECK enforcement must be reviewed.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND TABLE_TYPE = 'BASE TABLE' AND UPPER(ENGINE) = 'INNODB';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT is missing or is not InnoDB.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND UPPER(COLUMN_NAME) = 'COSTINCURRED' AND DATA_TYPE = 'decimal'
    AND COLUMN_TYPE = 'decimal(15,2)' AND NUMERIC_PRECISION = 15
    AND NUMERIC_SCALE = 2 AND IS_NULLABLE = 'YES';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred differs from nullable DECIMAL(15,2).';
  END IF;

  SELECT COUNT(*) INTO v_primary_columns
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND UPPER(CONSTRAINT_NAME) = 'PRIMARY';
  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND UPPER(CONSTRAINT_NAME) = 'PRIMARY' AND UPPER(COLUMN_NAME) = 'MAINTENANCEID'
    AND ORDINAL_POSITION = 1;
  IF v_primary_columns <> 1 OR v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT primary key differs from the reviewed MaintenanceID key.';
  END IF;

  SELECT COUNT(*) INTO v_primary_columns
  FROM information_schema.KEY_COLUMN_USAGE AS kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(kcu.TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE AS kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(kcu.TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND (
      (UPPER(kcu.CONSTRAINT_NAME) = 'MAINTENANCE_EVENT_IBFK_1'
        AND UPPER(kcu.COLUMN_NAME) = 'WORKORDERID'
        AND UPPER(kcu.REFERENCED_TABLE_NAME) = 'MAINTENANCE_WORK_ORDER'
        AND UPPER(kcu.REFERENCED_COLUMN_NAME) = 'WORKORDERID'
        AND UPPER(rc.DELETE_RULE) = 'NO ACTION' AND UPPER(rc.UPDATE_RULE) = 'NO ACTION')
      OR
      (UPPER(kcu.CONSTRAINT_NAME) = 'MAINTENANCE_EVENT_IBFK_2'
        AND UPPER(kcu.COLUMN_NAME) = 'PERFORMEDBY'
        AND UPPER(kcu.REFERENCED_TABLE_NAME) = 'USER'
        AND UPPER(kcu.REFERENCED_COLUMN_NAME) = 'USERID'
        AND UPPER(rc.DELETE_RULE) = 'NO ACTION' AND UPPER(rc.UPDATE_RULE) = 'NO ACTION')
    );
  IF v_primary_columns <> 2 OR v_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_EVENT foreign keys differ from the reviewed schema.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TRIGGERS
  WHERE TRIGGER_SCHEMA = DATABASE() AND (
    (UPPER(TRIGGER_NAME) = 'TRG_MAINTENANCE_EVENT_REQUIRE_COST_BEFORE_INSERT'
      AND UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_EVENT' AND UPPER(EVENT_MANIPULATION) = 'INSERT' AND UPPER(ACTION_TIMING) = 'BEFORE'
      AND UPPER(ACTION_STATEMENT) LIKE '%NEW.COSTINCURRED IS NULL%') OR
    (UPPER(TRIGGER_NAME) = 'TRG_MAINTENANCE_EVENT_REQUIRE_COST_BEFORE_UPDATE'
      AND UPPER(EVENT_OBJECT_TABLE) = 'MAINTENANCE_EVENT' AND UPPER(EVENT_MANIPULATION) = 'UPDATE' AND UPPER(ACTION_TIMING) = 'BEFORE'
      AND UPPER(ACTION_STATEMENT) LIKE '%NEW.COSTINCURRED IS NULL%'
      AND UPPER(ACTION_STATEMENT) LIKE '%OLD.COSTINCURRED IS NOT NULL%')
  );
  IF v_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected maintenance-cost NULL-protection triggers are missing or differ.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND UPPER(CONSTRAINT_NAME) = 'CHK_MAINTENANCE_EVENT_COST_NONNEGATIVE';
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reserved cost CHECK name already exists; inspect it before applying.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM maintenance_event WHERE CostIncurred < 0;
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Negative historical CostIncurred values exist; review the preceding ID/cost report and stop for approved remediation.';
  END IF;

  SELECT 'Preflight passed; no negative maintenance costs found.' AS Result,
         v_count AS NegativeCostRows;
END//
DELIMITER ;

CALL darms_preflight_nonnegative_maintenance_cost_20261105();
DROP PROCEDURE darms_preflight_nonnegative_maintenance_cost_20261105;

ALTER TABLE maintenance_event
  ADD CONSTRAINT chk_maintenance_event_cost_nonnegative
  CHECK (CostIncurred >= 0) ENFORCED;

SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE, tc.ENFORCED
FROM information_schema.TABLE_CONSTRAINTS AS tc
JOIN information_schema.CHECK_CONSTRAINTS AS cc
  ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
 AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
  AND LOWER(tc.TABLE_NAME) = 'maintenance_event'
  AND LOWER(tc.CONSTRAINT_NAME) = 'chk_maintenance_event_cost_nonnegative'
  AND tc.CONSTRAINT_TYPE = 'CHECK';
