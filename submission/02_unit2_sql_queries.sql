/*
  Unit 2: SQL queries, joins, nested/correlated queries, views,
  CTEs, window functions, and query optimization.

  All statements are read-only. The readiness view already exists in the
  exported database and is queried without recreation.
*/

USE defence_asset_system;

-- Nested subquery: assets with maintenance costs above the overall average.
SELECT DISTINCT a.AssetID, a.AssetName
FROM ASSET AS a
JOIN MAINTENANCE_WORK_ORDER AS wo ON wo.AssetID = a.AssetID
JOIN MAINTENANCE_EVENT AS me ON me.WorkOrderID = wo.WorkOrderID
WHERE me.CostIncurred >
      (SELECT AVG(CostIncurred) FROM MAINTENANCE_EVENT);

-- True correlated subquery: assets with at least one high-severity failure.
SELECT a.AssetID, a.AssetName
FROM ASSET AS a
WHERE EXISTS (
    SELECT 1
    FROM FAILURE_EVENT AS f
    WHERE f.AssetID = a.AssetID
      AND f.Severity = 'High'
);

-- Correlated aggregate: assets whose failure count is at least two.
SELECT a.AssetID, a.AssetName
FROM ASSET AS a
WHERE (
    SELECT COUNT(*)
    FROM FAILURE_EVENT AS f
    WHERE f.AssetID = a.AssetID
) >= 2;

-- NULL-aware aggregate demonstration.
SELECT COUNT(*) AS AllEvents,
       COUNT(CostIncurred) AS EventsWithCost,
       AVG(CostIncurred) AS AverageRecordedCost
FROM MAINTENANCE_EVENT;

-- Existing readiness view.
SELECT *
FROM asset_readiness_view
ORDER BY AssetID;

-- CTE: total maintenance cost by work order.
WITH MaintenanceSummary AS (
    SELECT WorkOrderID, SUM(CostIncurred) AS TotalCost
    FROM MAINTENANCE_EVENT
    GROUP BY WorkOrderID
)
SELECT WorkOrderID, TotalCost
FROM MaintenanceSummary
ORDER BY TotalCost DESC;

-- Window function: rank maintenance events by cost.
SELECT MaintenanceID, MaintenanceType, CostIncurred,
       RANK() OVER (ORDER BY CostIncurred DESC) AS CostRank
FROM MAINTENANCE_EVENT;

-- Query optimization evidence; inspect the plan without changing data.
EXPLAIN
SELECT a.AssetID, a.AssetName, f.FailureType, f.OccurredAt
FROM ASSET AS a
JOIN FAILURE_EVENT AS f ON f.AssetID = a.AssetID
WHERE a.Status IN ('Unavailable', 'Degraded')
ORDER BY f.OccurredAt DESC;
