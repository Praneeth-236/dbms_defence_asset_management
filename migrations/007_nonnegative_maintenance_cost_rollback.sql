/*
  Reversible rollback for 007_nonnegative_maintenance_cost.sql.
  This removes only the named CHECK constraint. It does not alter any costs.
*/
USE defence_asset_system;

DROP PROCEDURE IF EXISTS darms_preflight_nonnegative_maintenance_cost_rollback_20261105;
DELIMITER //
CREATE PROCEDURE darms_preflight_nonnegative_maintenance_cost_rollback_20261105()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database; expected defence_asset_system.';
  END IF;
  IF VERSION() NOT LIKE '8.0.46%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unexpected MySQL version; review rollback before applying.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLE_CONSTRAINTS AS tc
  JOIN information_schema.CHECK_CONSTRAINTS AS cc
    ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
   AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(tc.TABLE_NAME) = 'MAINTENANCE_EVENT'
    AND UPPER(tc.CONSTRAINT_NAME) = 'CHK_MAINTENANCE_EVENT_COST_NONNEGATIVE'
    AND tc.CONSTRAINT_TYPE = 'CHECK'
    AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(cc.CHECK_CLAUSE, '`', ''), ' ', ''), '(', ''), ')', '')) = 'costincurred>=0'
    AND tc.ENFORCED = 'YES';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected enforced CostIncurred >= 0 CHECK was not found; no rollback was applied.';
  END IF;
END//
DELIMITER ;

CALL darms_preflight_nonnegative_maintenance_cost_rollback_20261105();
DROP PROCEDURE darms_preflight_nonnegative_maintenance_cost_rollback_20261105;

ALTER TABLE maintenance_event
  DROP CHECK chk_maintenance_event_cost_nonnegative;

SELECT COUNT(*) AS RemainingNamedCostChecks
FROM information_schema.CHECK_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND UPPER(CONSTRAINT_NAME) = 'CHK_MAINTENANCE_EVENT_COST_NONNEGATIVE';
