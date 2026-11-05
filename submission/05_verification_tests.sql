/*
  Read-only verification and expected-result checks.
  No data is inserted, changed, or deleted.
*/

USE defence_asset_system;

-- Expected: zero orphan asset-to-unit references.
SELECT COUNT(*) AS OrphanAssetUnits
FROM ASSET AS a
LEFT JOIN UNIT AS u ON u.UnitID = a.UnitID
WHERE u.UnitID IS NULL;

-- Expected: zero orphan work-order-to-asset references.
SELECT COUNT(*) AS OrphanWorkOrders
FROM MAINTENANCE_WORK_ORDER AS wo
LEFT JOIN ASSET AS a ON a.AssetID = wo.AssetID
WHERE a.AssetID IS NULL;

-- Expected: zero self-dependencies; enforced by the exported CHECK constraint.
SELECT COUNT(*) AS SelfDependencies
FROM COMPONENT_DEPENDENCY
WHERE ComponentID = DependsOnComponentID;

-- Expected: zero duplicate component-spare mappings.
SELECT ComponentID, SparePartID, COUNT(*) AS MappingCount
FROM COMPONENT_SPARE
GROUP BY ComponentID, SparePartID
HAVING COUNT(*) > 1;

-- Expected: zero negative stock rows.
SELECT SparePartID, PartName, StockQuantity
FROM SPARE_PART
WHERE StockQuantity < 0;

-- Expected: every maintenance event references an existing user and work order.
SELECT me.MaintenanceID
FROM MAINTENANCE_EVENT AS me
LEFT JOIN `USER` AS u ON u.UserID = me.PerformedBy
LEFT JOIN MAINTENANCE_WORK_ORDER AS wo ON wo.WorkOrderID = me.WorkOrderID
WHERE u.UserID IS NULL OR wo.WorkOrderID IS NULL;

-- Expected: one row per primary-key value.
SELECT 'ASSET' AS TableName, COUNT(*) AS RowsPresent,
       COUNT(DISTINCT AssetID) AS DistinctKeys
FROM ASSET
UNION ALL
SELECT 'USER', COUNT(*), COUNT(DISTINCT UserID)
FROM `USER`
UNION ALL
SELECT 'MAINTENANCE_EVENT', COUNT(*), COUNT(DISTINCT MaintenanceID)
FROM MAINTENANCE_EVENT;
