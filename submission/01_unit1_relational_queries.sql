/*
  Unit 1: relational operations, joins, aggregates, and grouping
  Read-only demonstrations using the existing schema.
*/

USE defence_asset_system;

-- Selection and projection: unavailable high-criticality assets.
SELECT AssetID, AssetName, Status, CriticalityLevel
FROM ASSET
WHERE Status = 'Unavailable'
  AND CriticalityLevel = 'High';

-- Binary relational operation: assets assigned to units and services.
SELECT a.AssetName, u.UnitName, s.ServiceName
FROM ASSET AS a
JOIN UNIT AS u ON u.UnitID = a.UnitID
JOIN SERVICE AS s ON s.ServiceID = u.ServiceID;

-- Aggregate and grouping: maintenance cost and downtime by type.
SELECT MaintenanceType,
       COUNT(*) AS EventCount,
       SUM(CostIncurred) AS TotalCost,
       AVG(DowntimeHours) AS AverageDowntime
FROM MAINTENANCE_EVENT
GROUP BY MaintenanceType;

-- Group filtering with HAVING.
SELECT Status, COUNT(*) AS AssetCount
FROM ASSET
GROUP BY Status
HAVING COUNT(*) >= 1;

-- Set operation: assets that are Ready or Degraded.
SELECT AssetName
FROM ASSET
WHERE Status = 'Ready'
UNION
SELECT AssetName
FROM ASSET
WHERE Status = 'Degraded';

-- Relational-algebra mapping:
-- selection = WHERE, projection = selected columns,
-- join = JOIN ... ON, union = UNION, grouping = GROUP BY.
