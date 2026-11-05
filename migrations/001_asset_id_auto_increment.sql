/*
  Safe schema migration for the existing ASSET table.

  AssetID is already the primary key and existing rows (including 401-405)
  are preserved. MySQL chooses the next generated value above the current
  maximum and serializes concurrent inserts through the InnoDB auto-increment
  mechanism.

  Run this once against the existing defence_asset_system database. Do not
  run Dump20261101.sql to apply this change; that export drops tables.
*/

USE defence_asset_system;

/*
  Existing-schema migration for database-generated ASSET.AssetID values.

  This migration preserves all ASSET rows and child indexes. It does not
  disable FOREIGN_KEY_CHECKS and does not drop or recreate any table.
  Run it once against the intended defence_asset_system database.
*/

USE defence_asset_system;

DROP PROCEDURE IF EXISTS apply_asset_id_migration;
DELIMITER //

CREATE PROCEDURE apply_asset_id_migration()
BEGIN
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE v_asset_count BIGINT DEFAULT 0;
  DECLARE v_distinct_asset_count BIGINT DEFAULT 0;
  DECLARE v_max_asset_id BIGINT DEFAULT 0;
  DECLARE v_next_asset_id BIGINT DEFAULT 0;

  IF DATABASE() <> 'defence_asset_system' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Wrong database selected; expected defence_asset_system.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('ASSET', 'FAILURE_EVENT', 'MAINTENANCE_WORK_ORDER', 'SUBSYSTEM')
    AND TABLE_TYPE = 'BASE TABLE';
  IF v_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required ASSET tables are missing.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ASSET'
    AND COLUMN_NAME = 'AssetID'
    AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO'
    AND COLUMN_KEY = 'PRI'
    AND EXTRA NOT LIKE '%auto_increment%';
  IF v_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ASSET.AssetID is not the expected non-auto-increment INT primary key.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT AssetID), COALESCE(MAX(AssetID), 0)
    INTO v_asset_count, v_distinct_asset_count, v_max_asset_id
  FROM ASSET;
  IF v_asset_count <> v_distinct_asset_count THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ASSET contains duplicate AssetID values; migration stopped.';
  END IF;
  IF v_max_asset_id >= 2147483647 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ASSET.AssetID has reached the INT limit; migration stopped.';
  END IF;
  SET v_next_asset_id = v_max_asset_id + 1;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('FAILURE_EVENT', 'MAINTENANCE_WORK_ORDER', 'SUBSYSTEM')
    AND COLUMN_NAME = 'AssetID'
    AND COLUMN_TYPE = 'int'
    AND IS_NULLABLE = 'NO';
  IF v_count <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'One or more child AssetID columns differ from the expected INT NOT NULL schema.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME = k.TABLE_NAME
   AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
  WHERE k.CONSTRAINT_SCHEMA = DATABASE()
    AND (
      (k.TABLE_NAME = 'FAILURE_EVENT' AND k.CONSTRAINT_NAME = 'failure_event_ibfk_1') OR
      (k.TABLE_NAME = 'MAINTENANCE_WORK_ORDER' AND k.CONSTRAINT_NAME = 'maintenance_work_order_ibfk_1') OR
      (k.TABLE_NAME = 'SUBSYSTEM' AND k.CONSTRAINT_NAME = 'subsystem_ibfk_1')
    )
    AND k.COLUMN_NAME = 'AssetID'
    AND k.REFERENCED_TABLE_NAME = 'ASSET'
    AND k.REFERENCED_COLUMN_NAME = 'AssetID'
    AND r.DELETE_RULE IN ('NO ACTION', 'RESTRICT')
    AND r.UPDATE_RULE IN ('NO ACTION', 'RESTRICT');
  IF v_count <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expected AssetID foreign-key constraints or rules are missing/different.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'FAILURE_EVENT'
    AND COLUMN_NAME = 'AssetID'
    AND SEQ_IN_INDEX = 1
    AND INDEX_NAME <> 'PRIMARY';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FAILURE_EVENT.AssetID child index is missing.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MAINTENANCE_WORK_ORDER'
    AND COLUMN_NAME = 'AssetID'
    AND SEQ_IN_INDEX = 1
    AND INDEX_NAME <> 'PRIMARY';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_WORK_ORDER.AssetID child index is missing.';
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'SUBSYSTEM'
    AND COLUMN_NAME = 'AssetID'
    AND SEQ_IN_INDEX = 1
    AND INDEX_NAME <> 'PRIMARY';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBSYSTEM.AssetID child index is missing.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM FAILURE_EVENT f LEFT JOIN ASSET a ON a.AssetID = f.AssetID WHERE a.AssetID IS NULL;
  IF v_count <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FAILURE_EVENT contains orphan AssetID values.'; END IF;
  SELECT COUNT(*) INTO v_count FROM MAINTENANCE_WORK_ORDER w LEFT JOIN ASSET a ON a.AssetID = w.AssetID WHERE a.AssetID IS NULL;
  IF v_count <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MAINTENANCE_WORK_ORDER contains orphan AssetID values.'; END IF;
  SELECT COUNT(*) INTO v_count FROM SUBSYSTEM s LEFT JOIN ASSET a ON a.AssetID = s.AssetID WHERE a.AssetID IS NULL;
  IF v_count <> 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUBSYSTEM contains orphan AssetID values.'; END IF;

  ALTER TABLE FAILURE_EVENT DROP FOREIGN KEY failure_event_ibfk_1;
  ALTER TABLE MAINTENANCE_WORK_ORDER DROP FOREIGN KEY maintenance_work_order_ibfk_1;
  ALTER TABLE SUBSYSTEM DROP FOREIGN KEY subsystem_ibfk_1;

  SET @asset_alter_sql = CONCAT('ALTER TABLE ASSET MODIFY COLUMN AssetID INT NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = ', v_next_asset_id);
  PREPARE asset_alter FROM @asset_alter_sql;
  EXECUTE asset_alter;
  DEALLOCATE PREPARE asset_alter;

  ALTER TABLE FAILURE_EVENT
    ADD CONSTRAINT failure_event_ibfk_1 FOREIGN KEY (AssetID) REFERENCES ASSET (AssetID);
  ALTER TABLE MAINTENANCE_WORK_ORDER
    ADD CONSTRAINT maintenance_work_order_ibfk_1 FOREIGN KEY (AssetID) REFERENCES ASSET (AssetID);
  ALTER TABLE SUBSYSTEM
    ADD CONSTRAINT subsystem_ibfk_1 FOREIGN KEY (AssetID) REFERENCES ASSET (AssetID);

  SELECT 'AssetID AUTO_INCREMENT migration applied' AS Result,
         v_asset_count AS PreservedAssetRows,
         v_max_asset_id AS ExistingMaximumAssetID,
         v_next_asset_id AS NextGeneratedAssetID;
END//

DELIMITER ;

CALL apply_asset_id_migration();
DROP PROCEDURE apply_asset_id_migration;
