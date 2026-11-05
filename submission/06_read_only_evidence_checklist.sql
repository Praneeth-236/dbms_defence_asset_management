/*
  Read-only SQL evidence checklist.
  Run only against a safe review database, never against the live database
  when collecting screenshots. This file contains SELECT/SHOW/EXPLAIN only.
*/

USE defence_asset_system;

-- DDL: tables, columns, keys, foreign keys, checks, and indexes.
SELECT TABLE_NAME, TABLE_TYPE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_KEY, IS_NULLABLE, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- Programmable objects.
SHOW FULL TABLES IN defence_asset_system;
SHOW CREATE VIEW asset_readiness_view;
SHOW CREATE FUNCTION get_failure_count;
SHOW CREATE PROCEDURE update_asset_status;
SELECT TRIGGER_NAME
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME IN (
    'trg_asset_repair_status',
    'trg_work_order_asset_unavailable_after_insert',
    'trg_work_order_asset_status_after_update',
    'trg_work_order_asset_status_after_delete',
    'trg_maintenance_event_require_cost_before_insert',
    'trg_maintenance_event_require_cost_before_update'
  )
ORDER BY TRIGGER_NAME;
-- Expected after migration 004: five reviewed triggers, no legacy repair trigger.

-- Reconciliation preview only: includes assets with no active work orders.
-- No status is inferred or updated by this query.
SELECT a.AssetID, a.AssetName, a.Status AS CurrentAssetStatus,
       COUNT(wo.WorkOrderID) AS ActiveWorkOrders
FROM ASSET AS a
LEFT JOIN MAINTENANCE_WORK_ORDER AS wo
  ON wo.AssetID = a.AssetID AND wo.Status IN ('Open', 'InProgress')
GROUP BY a.AssetID, a.AssetName, a.Status
ORDER BY a.AssetID;

-- DML/query evidence: basic SELECT, joins, aggregates, grouping, and set operation.
SELECT a.AssetID, a.AssetName, u.UnitName, s.ServiceName
FROM ASSET AS a
JOIN UNIT AS u ON u.UnitID = a.UnitID
JOIN SERVICE AS s ON s.ServiceID = u.ServiceID;

SELECT Status, COUNT(*) AS AssetCount
FROM ASSET
GROUP BY Status;

SELECT AssetName FROM ASSET WHERE Status = 'Ready'
UNION
SELECT AssetName FROM ASSET WHERE Status = 'Degraded';

-- Nested/correlated query, CTE, window function, and query plan.
SELECT a.AssetID, a.AssetName
FROM ASSET AS a
WHERE EXISTS (
  SELECT 1 FROM FAILURE_EVENT AS f
  WHERE f.AssetID = a.AssetID AND f.Severity = 'High'
);

WITH MaintenanceSummary AS (
  SELECT WorkOrderID, SUM(CostIncurred) AS TotalCost
  FROM MAINTENANCE_EVENT
  GROUP BY WorkOrderID
)
SELECT WorkOrderID, TotalCost
FROM MaintenanceSummary
ORDER BY TotalCost DESC;

SELECT MaintenanceID, CostIncurred,
       RANK() OVER (ORDER BY CostIncurred DESC) AS CostRank
FROM MAINTENANCE_EVENT;

EXPLAIN
SELECT a.AssetID, a.AssetName, f.FailureType
FROM ASSET AS a
JOIN FAILURE_EVENT AS f ON f.AssetID = a.AssetID
WHERE a.Status IN ('Unavailable', 'Degraded');

-- Integrity checks: expected screenshots should show zero violations.
SELECT COUNT(*) AS OrphanWorkOrders
FROM MAINTENANCE_WORK_ORDER AS wo
LEFT JOIN ASSET AS a ON a.AssetID = wo.AssetID
WHERE a.AssetID IS NULL;

SELECT COUNT(*) AS SelfDependencies
FROM COMPONENT_DEPENDENCY
WHERE ComponentID = DependsOnComponentID;

/*
  Not included here: INSERT, UPDATE, DELETE, transaction/locking, procedure
  execution, and trigger side-effect tests. Capture those only in a disposable
  test database because they can change data or block other sessions.
*/
