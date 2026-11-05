/*
  Asset creation verification.

  Run only against a disposable/review database containing the corrected seed
  rows. Every data-changing check is rolled back. This script does not create,
  drop, or recreate tables.
*/

USE defence_asset_system;

-- The migration must be applied before the API can omit AssetID safely.
SELECT TABLE_NAME, COLUMN_NAME, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ASSET'
  AND COLUMN_NAME = 'AssetID';

-- Successful generated-ID insert; the existing rows are preserved by rollback.
START TRANSACTION;
INSERT INTO ASSET
    (AssetName, Model, Status, CriticalityLevel, UnitID, AssetTypeID)
VALUES
    ('Asset creation verification', 'Verification model', 'Ready', 'Medium', 201, 301);
SELECT AssetID, AssetName, UnitID, AssetTypeID
FROM ASSET
WHERE AssetName = 'Asset creation verification';
ROLLBACK;

-- A missing unit must be rejected by the foreign key.
START TRANSACTION;
INSERT INTO ASSET
    (AssetName, Model, Status, CriticalityLevel, UnitID, AssetTypeID)
VALUES
    ('Invalid unit verification', 'Verification model', 'Ready', 'Medium', 2147483647, 301);
ROLLBACK;

-- A missing asset type must be rejected by the foreign key.
START TRANSACTION;
INSERT INTO ASSET
    (AssetName, Model, Status, CriticalityLevel, UnitID, AssetTypeID)
VALUES
    ('Invalid type verification', 'Verification model', 'Ready', 'Medium', 201, 2147483647);
ROLLBACK;

-- Run two successful inserts from separate sessions to verify distinct IDs.
-- InnoDB AUTO_INCREMENT allocation serializes these requests; compare the
-- returned AssetID values, then roll both transactions back.