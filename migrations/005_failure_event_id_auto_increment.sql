/*
  Enable MySQL-generated FAILURE_EVENT.FailureID values.

  DDL is not transactionally rolled back. This routine verifies the exact
  inspection_ibfk_1 definition before dropping it, restores it in an SQL
  exception handler, and detects/restores the missing-FK intermediate state
  if the client or server stops between DDL statements. Run with application
  writers quiesced. Never use mysql --force or blindly rerun after an error.
*/
USE defence_asset_system;

DELIMITER //
CREATE PROCEDURE darms_migrate_failure_event_id_20261105()
migration_main: BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE v_rows BIGINT DEFAULT 0;
  DECLARE v_distinct_ids BIGINT DEFAULT 0;
  DECLARE v_min_id BIGINT DEFAULT 0;
  DECLARE v_max_id BIGINT DEFAULT 0;
  DECLARE v_after_rows BIGINT DEFAULT 0;
  DECLARE v_after_distinct_ids BIGINT DEFAULT 0;
  DECLARE v_after_min_id BIGINT DEFAULT 0;
  DECLARE v_after_max_id BIGINT DEFAULT 0;
  DECLARE v_id_extra VARCHAR(128) DEFAULT '';
  DECLARE v_auto_increment_enabled TINYINT DEFAULT 0;
  DECLARE v_fk_named_count BIGINT DEFAULT 0;
  DECLARE v_fk_exact_count BIGINT DEFAULT 0;
  DECLARE v_fk_inbound_count BIGINT DEFAULT 0;
  DECLARE v_fk_dropped TINYINT DEFAULT 0;
  DECLARE v_recovery_failed TINYINT DEFAULT 0;
  DECLARE v_handler_fk_count BIGINT DEFAULT 0;
  DECLARE v_handler_named_count BIGINT DEFAULT 0;
  DECLARE v_handler_inbound_count BIGINT DEFAULT 0;
  DECLARE v_handler_orphans BIGINT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    IF v_fk_dropped = 1 THEN
      BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_recovery_failed = 1;

        SELECT COUNT(*) INTO v_handler_fk_count
        FROM information_schema.KEY_COLUMN_USAGE k
        JOIN information_schema.REFERENTIAL_CONSTRAINTS r
          ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
         AND r.TABLE_NAME = k.TABLE_NAME
         AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        WHERE k.CONSTRAINT_SCHEMA = DATABASE()
          AND UPPER(k.TABLE_NAME) = 'INSPECTION'
          AND UPPER(k.COLUMN_NAME) = 'FAILUREID'
          AND UPPER(k.CONSTRAINT_NAME) = 'INSPECTION_IBFK_1'
          AND UPPER(k.REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
          AND UPPER(k.REFERENCED_COLUMN_NAME) = 'FAILUREID'
          AND UPPER(r.DELETE_RULE) = 'NO ACTION'
          AND UPPER(r.UPDATE_RULE) = 'NO ACTION';

        IF v_handler_fk_count = 0 THEN
          SELECT COUNT(*) INTO v_handler_named_count
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND UPPER(CONSTRAINT_NAME) = 'INSPECTION_IBFK_1';
          SELECT COUNT(*) INTO v_handler_inbound_count
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
            AND UPPER(REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
            AND UPPER(REFERENCED_COLUMN_NAME) = 'FAILUREID';
          SELECT COUNT(*) INTO v_handler_orphans
          FROM inspection i
          LEFT JOIN failure_event f ON f.FailureID = i.FailureID
          WHERE f.FailureID IS NULL;

          IF v_handler_named_count = 0
             AND v_handler_inbound_count = 0
             AND v_handler_orphans = 0 THEN
            ALTER TABLE inspection
              ADD CONSTRAINT inspection_ibfk_1
              FOREIGN KEY (FailureID) REFERENCES failure_event (FailureID)
              ON DELETE NO ACTION ON UPDATE NO ACTION;
          ELSE
            SET v_recovery_failed = 1;
          END IF;
        ELSEIF v_handler_fk_count <> 1 THEN
          SET v_recovery_failed = 1;
        END IF;
      END;

      IF v_recovery_failed = 1 THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Migration failed and automatic restoration of inspection_ibfk_1 failed; stop and inspect the disposable or target database before any retry.';
      END IF;
    END IF;
    RESIGNAL;
  END;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Wrong database; expected defence_asset_system.';
  END IF;
  IF VERSION() NOT LIKE '8.0.46%' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Unexpected MySQL version; review before applying.';
  END IF;
  IF @@FOREIGN_KEY_CHECKS <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FOREIGN_KEY_CHECKS must be enabled.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) IN ('ASSET', 'FAILURE_EVENT', 'INSPECTION', 'USER')
    AND TABLE_TYPE = 'BASE TABLE'
    AND UPPER(ENGINE) = 'INNODB'
    AND UPPER(TABLE_COLLATION) = 'UTF8MB4_0900_AI_CI';
  IF v_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Expected InnoDB/utf8mb4_0900_ai_ci tables are missing or differ.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT';
  IF v_count <> 6 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT column count differs from the reviewed schema.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND (
      (UPPER(COLUMN_NAME) = 'FAILUREID' AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
        AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI' AND EXTRA IN ('', 'auto_increment')
        AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'FAILURETYPE' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(100)' AND CHARACTER_MAXIMUM_LENGTH = 100
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'SEVERITY' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(20)' AND CHARACTER_MAXIMUM_LENGTH = 20
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'OCCURREDAT' AND DATA_TYPE = 'datetime'
        AND COLUMN_TYPE = 'datetime' AND IS_NULLABLE = 'YES'
        AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'DESCRIPTION' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(500)' AND CHARACTER_MAXIMUM_LENGTH = 500
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'ASSETID' AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
        AND IS_NULLABLE = 'NO' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
    );
  IF v_count <> 6 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT column definitions differ from the reviewed schema.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(INDEX_NAME) = 'PRIMARY';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT primary key must contain only FailureID.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(INDEX_NAME) = 'PRIMARY'
    AND UPPER(COLUMN_NAME) = 'FAILUREID'
    AND SEQ_IN_INDEX = 1;
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT primary key is not exactly FailureID.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT';
  IF v_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT index set differs from the reviewed schema.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(INDEX_NAME) = 'IDX_FAILURE_ASSET'
    AND UPPER(COLUMN_NAME) = 'ASSETID'
    AND SEQ_IN_INDEX = 1 AND NON_UNIQUE = 1;
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Expected FAILURE_EVENT AssetID index is missing or differs.';
  END IF;

  SELECT EXTRA INTO v_id_extra
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(COLUMN_NAME) = 'FAILUREID';
  IF v_id_extra NOT IN ('', 'auto_increment') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureID has unsupported column attributes.';
  END IF;
  SET v_auto_increment_enabled = (v_id_extra = 'auto_increment');

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'ASSET'
    AND UPPER(COLUMN_NAME) = 'ASSETID'
    AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'ASSET.AssetID differs from the expected signed INT primary key.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION';
  IF v_count <> 7 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION column count differs from the reviewed schema.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION'
    AND (
      (UPPER(COLUMN_NAME) = 'INSPECTIONID' AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
        AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'FAILUREID' AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
        AND IS_NULLABLE = 'NO' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'INSPECTORID' AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
        AND IS_NULLABLE = 'NO' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'INSPECTIONTYPE' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(100)' AND CHARACTER_MAXIMUM_LENGTH = 100
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'INSPECTIONDATE' AND DATA_TYPE = 'date'
        AND COLUMN_TYPE = 'date' AND IS_NULLABLE = 'YES'
        AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'RESULT' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(50)' AND CHARACTER_MAXIMUM_LENGTH = 50
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
      OR (UPPER(COLUMN_NAME) = 'REMARKS' AND DATA_TYPE = 'varchar'
        AND COLUMN_TYPE = 'varchar(500)' AND CHARACTER_MAXIMUM_LENGTH = 500
        AND IS_NULLABLE = 'YES' AND EXTRA = '' AND COLUMN_DEFAULT IS NULL)
    );
  IF v_count <> 7 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION column definitions differ from the reviewed schema.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION'
    AND UPPER(INDEX_NAME) = 'PRIMARY';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION primary key must contain only InspectionID.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION'
    AND UPPER(INDEX_NAME) = 'PRIMARY'
    AND UPPER(COLUMN_NAME) = 'INSPECTIONID'
    AND SEQ_IN_INDEX = 1;
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION primary key differs from the reviewed schema.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION';
  IF v_count <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION index set differs from the reviewed schema.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'USER'
    AND UPPER(COLUMN_NAME) = 'USERID'
    AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'USER.UserID differs from the expected signed INT primary key.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(k.TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(k.COLUMN_NAME) = 'ASSETID'
    AND UPPER(k.CONSTRAINT_NAME) = 'FAILURE_EVENT_IBFK_1'
    AND UPPER(k.REFERENCED_TABLE_NAME) = 'ASSET'
    AND UPPER(k.REFERENCED_COLUMN_NAME) = 'ASSETID'
    AND UPPER(r.DELETE_RULE) = 'NO ACTION'
    AND UPPER(r.UPDATE_RULE) = 'NO ACTION';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT.AssetID foreign key differs from the reviewed definition or rules.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT has unexpected or missing foreign-key relationships.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(k.TABLE_NAME) = 'INSPECTION'
    AND UPPER(k.COLUMN_NAME) = 'INSPECTORID'
    AND UPPER(k.CONSTRAINT_NAME) = 'INSPECTION_IBFK_2'
    AND UPPER(k.REFERENCED_TABLE_NAME) = 'USER'
    AND UPPER(k.REFERENCED_COLUMN_NAME) = 'USERID'
    AND UPPER(r.DELETE_RULE) = 'NO ACTION'
    AND UPPER(r.UPDATE_RULE) = 'NO ACTION';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION.InspectorID foreign key differs from the reviewed definition or rules.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'INSPECTION'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
  IF v_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION has unexpected or missing foreign-key relationships.';
  END IF;

  SELECT COUNT(*) INTO v_fk_named_count
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(CONSTRAINT_NAME) = 'INSPECTION_IBFK_1';
  SELECT COUNT(*) INTO v_fk_exact_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(k.TABLE_NAME) = 'INSPECTION'
    AND UPPER(k.COLUMN_NAME) = 'FAILUREID'
    AND UPPER(k.CONSTRAINT_NAME) = 'INSPECTION_IBFK_1'
    AND UPPER(k.REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(k.REFERENCED_COLUMN_NAME) = 'FAILUREID'
    AND UPPER(r.DELETE_RULE) = 'NO ACTION'
    AND UPPER(r.UPDATE_RULE) = 'NO ACTION';
  SELECT COUNT(*) INTO v_fk_inbound_count
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
    AND UPPER(REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(REFERENCED_COLUMN_NAME) = 'FAILUREID';

  IF v_fk_exact_count = 1 AND v_fk_named_count = 1 AND v_fk_inbound_count = 1 THEN
    SET @darms_failure_fk_present = 1;
  ELSEIF v_fk_exact_count = 0 AND v_fk_named_count = 0 AND v_fk_inbound_count = 0 THEN
    SET @darms_failure_fk_present = 0;
  ELSE
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'inspection_ibfk_1 is partially present or differs from the exact reviewed definition; no DDL was attempted.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT FailureID),
         COALESCE(MIN(FailureID), 0), COALESCE(MAX(FailureID), 0)
    INTO v_rows, v_distinct_ids, v_min_id, v_max_id
  FROM failure_event;
  IF v_rows <> v_distinct_ids THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureID values are not unique.';
  END IF;
  IF v_rows > 0 AND v_min_id <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureID values must be positive under the project seed convention.';
  END IF;
  IF v_min_id < -2147483648 OR v_max_id >= 2147483647 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureID values leave no valid signed INT auto-increment value.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM inspection i
  LEFT JOIN failure_event f ON f.FailureID = i.FailureID
  WHERE f.FailureID IS NULL;
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION contains orphan FailureID values; migration stopped.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM failure_event f
  LEFT JOIN asset a ON a.AssetID = f.AssetID
  WHERE a.AssetID IS NULL;
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FAILURE_EVENT contains orphan AssetID values; migration stopped.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM inspection i
  LEFT JOIN `user` u ON u.UserID = i.InspectorID
  WHERE u.UserID IS NULL;
  IF v_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'INSPECTION contains orphan InspectorID values; migration stopped.';
  END IF;

  SELECT VERSION() AS MySQLVersion, DATABASE() AS TargetDatabase,
         v_rows AS ExistingFailureRows, v_min_id AS MinimumFailureID,
         v_max_id AS MaximumFailureID,
         v_auto_increment_enabled AS AutoIncrementBefore,
         v_fk_exact_count AS ExactInspectionFailureFKBefore;

  IF v_fk_inbound_count = 0 THEN
    SET v_fk_dropped = 1;
    ALTER TABLE inspection
      ADD CONSTRAINT inspection_ibfk_1
      FOREIGN KEY (FailureID) REFERENCES failure_event (FailureID)
      ON DELETE NO ACTION ON UPDATE NO ACTION;

    SELECT COUNT(*) INTO v_fk_exact_count
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
     AND r.TABLE_NAME = k.TABLE_NAME
     AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.CONSTRAINT_SCHEMA = DATABASE()
      AND UPPER(k.TABLE_NAME) = 'INSPECTION'
      AND UPPER(k.COLUMN_NAME) = 'FAILUREID'
      AND UPPER(k.CONSTRAINT_NAME) = 'INSPECTION_IBFK_1'
      AND UPPER(k.REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
      AND UPPER(k.REFERENCED_COLUMN_NAME) = 'FAILUREID'
      AND UPPER(r.DELETE_RULE) = 'NO ACTION'
      AND UPPER(r.UPDATE_RULE) = 'NO ACTION';
    IF v_fk_exact_count <> 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Partial-state FK restoration did not verify; stop and inspect.';
    END IF;
    SET v_fk_dropped = 0;

    IF v_auto_increment_enabled = 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Partial state detected: inspection_ibfk_1 was restored; AUTO_INCREMENT was not changed. Review state before a separately initiated retry.';
    END IF;

    SELECT 'Partial state repaired: verified inspection_ibfk_1 restored; AUTO_INCREMENT was already enabled.' AS Result;
    LEAVE migration_main;
  END IF;

  IF v_auto_increment_enabled = 1 THEN
    SELECT 'Already complete: AUTO_INCREMENT and verified inspection_ibfk_1 are present.' AS Result;
    LEAVE migration_main;
  END IF;

  ALTER TABLE inspection DROP FOREIGN KEY inspection_ibfk_1;
  SET v_fk_dropped = 1;

  ALTER TABLE failure_event
    MODIFY COLUMN FailureID INT NOT NULL AUTO_INCREMENT;

  ALTER TABLE inspection
    ADD CONSTRAINT inspection_ibfk_1
    FOREIGN KEY (FailureID) REFERENCES failure_event (FailureID)
    ON DELETE NO ACTION ON UPDATE NO ACTION;

  SELECT COUNT(*) INTO v_fk_exact_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND UPPER(k.TABLE_NAME) = 'INSPECTION'
    AND UPPER(k.COLUMN_NAME) = 'FAILUREID'
    AND UPPER(k.CONSTRAINT_NAME) = 'INSPECTION_IBFK_1'
    AND UPPER(k.REFERENCED_TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(k.REFERENCED_COLUMN_NAME) = 'FAILUREID'
    AND UPPER(r.DELETE_RULE) = 'NO ACTION'
    AND UPPER(r.UPDATE_RULE) = 'NO ACTION';
  IF v_fk_exact_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Recreated inspection_ibfk_1 did not match the original definition and rules.';
  END IF;
  SET v_fk_dropped = 0;

  SELECT COUNT(*), COUNT(DISTINCT FailureID),
         COALESCE(MIN(FailureID), 0), COALESCE(MAX(FailureID), 0)
    INTO v_after_rows, v_after_distinct_ids, v_after_min_id, v_after_max_id
  FROM failure_event;
  IF v_after_rows <> v_rows OR v_after_distinct_ids <> v_distinct_ids
     OR v_after_min_id <> v_min_id OR v_after_max_id <> v_max_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureEvent rows or ID range changed during migration.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND UPPER(TABLE_NAME) = 'FAILURE_EVENT'
    AND UPPER(COLUMN_NAME) = 'FAILUREID'
    AND DATA_TYPE = 'int' AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO' AND COLUMN_KEY = 'PRI'
    AND EXTRA = 'auto_increment';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FailureID AUTO_INCREMENT postcondition failed.';
  END IF;

  SELECT 'FailureID AUTO_INCREMENT enabled; inspection_ibfk_1 preserved.' AS Result,
         v_after_rows AS PreservedFailureRows,
         v_after_min_id AS PreservedMinimumFailureID,
         v_after_max_id AS PreservedMaximumFailureID;
END//
DELIMITER ;

CALL darms_migrate_failure_event_id_20261105();
DROP PROCEDURE darms_migrate_failure_event_id_20261105;
