/* ==================
  PART 1: INSERT DATA
 ==================*/


-- 1.COUNTRY
INSERT INTO COUNTRY
(CountryID, CountryName, Region)
VALUES
(1, 'India', 'South Asia'),
(2, 'France', 'Europe'),
(3, 'Japan', 'East Asia');


--2. USER
INSERT INTO `USER`
(UserID, UserName, PasswordHash, FullName, Role, Email, Phone)
VALUES
(101, 'analyst01', 'hash_demo_101', 'Arjun Rao',
 'Analyst', 'analyst01@example.com', '9000000001'),
(102, 'admin01', 'hash_demo_102', 'Kiran Sharma',
 'Admin', 'admin01@example.com', '9000000002'),
(103, 'inspector01', 'hash_demo_103', 'Vikram Nair',
 'Inspector', 'inspector01@example.com', '9000000003');


-- 3.SERVICE
INSERT INTO SERVICE
(ServiceID, ServiceName, Description, CountryID)
VALUES
(1, 'Indian Air Force', 'Air service of India', 1),
(2, 'Indian Navy', 'Naval service of India', 1),
(3, 'Indian Army', 'Land service of India', 1);


--4. DEFENCE_INDICATOR
INSERT INTO DEFENCE_INDICATOR
(IndicatorID, CountryID, Year, DefenceBudget,
 RevenueExpenditure, CapitalExp, MaintenanceExp,
 IndigenisationIndex, Notes)
VALUES
(1001, 1, 2024, 620000.00, 360000.00, 260000.00,
 85000.00, 68.50, 'Synthetic demonstration data'),
(1002, 1, 2025, 680000.00, 380000.00, 300000.00,
 92000.00, 72.00, 'Synthetic demonstration data'),
(1003, 2, 2025, 610000.00, 350000.00, 260000.00,
 88000.00, 70.00, 'Synthetic demonstration data'),
(1004, 3, 2025, 540000.00, 330000.00, 210000.00,
 76000.00, 65.00, 'Synthetic demonstration data');


--5. UNIT
INSERT INTO UNIT
(UnitID, UnitName, Type, Location, ServiceID)
VALUES
(201, 'Fighter Squadron Alpha', 'Formation', 'Bengaluru', 1),
(202, 'Transport Squadron Bravo', 'Formation', 'Chandigarh', 1),
(203, 'Naval Support Unit', 'Base', 'Kochi', 2),
(204, 'Armoured Unit Charlie', 'Formation', 'Jaisalmer', 3);


-- 6.ASSET_TYPE
INSERT INTO ASSET_TYPE
(AssetTypeID, AssetTypeName, Category, Description)
VALUES
(301, 'Fighter Aircraft', 'Aircraft',
 'Synthetic fighter aircraft asset category'),
(302, 'Transport Aircraft', 'Aircraft',
 'Synthetic transport aircraft category'),
(303, 'Naval Support Platform', 'Naval',
 'Synthetic naval support asset category'),
(304, 'Armoured Vehicle', 'Land',
 'Synthetic armoured vehicle category');


--7. ASSET
INSERT INTO ASSET
(AssetID, AssetName, IdentificationNo, Model,
 MnfYear, Status, CriticalityLevel, UnitID, AssetTypeID)
VALUES
(401, 'Fighter Asset A-101', 'IAF-SYN-101',
 'Fighter-Mk1', 2023, 'Ready', 'High', 201, 301),
(402, 'Fighter Asset A-102', 'IAF-SYN-102',
 'Fighter-Mk1', 2022, 'Degraded', 'High', 201, 301),
(403, 'Transport Asset T-201', 'IAF-SYN-201',
 'Transport-X', 2021, 'Ready', 'Medium', 202, 302),
(404, 'Naval Asset N-301', 'IN-SYN-301',
 'Naval-X', 2024, 'Ready', 'High', 203, 303),
(405, 'Armoured Asset L-401', 'IA-SYN-401',
 'Armour-X', 2022, 'Unavailable', 'High', 204, 304);


--8. FAILURE_EVENT
INSERT INTO FAILURE_EVENT
(FailureID, FailureType, Severity, OccurredAt,
 Description, AssetID)
VALUES
(501, 'Cooling System Failure', 'High',
 '2026-09-20 10:30:00',
 'Abnormal cooling performance detected', 402),
(502, 'Hydraulic Failure', 'Medium',
 '2026-09-21 14:15:00',
 'Hydraulic pressure below expected range', 405),
(503, 'Power System Failure', 'High',
 '2026-09-23 09:45:00',
 'Power subsystem malfunction detected', 401);


--9. INSPECTION
INSERT INTO INSPECTION
(InspectionID, FailureID, InspectorID,
 InspectionType, InspectionDate, Result, Remarks)
VALUES
(601, 501, 103,
 'Technical Inspection', '2026-09-20',
 'Fail', 'Cooling component requires replacement'),
(602, 502, 103,
 'Technical Inspection', '2026-09-21',
 'Pass', 'Temporary issue identified'),
(603, 503, 103,
 'Technical Inspection', '2026-09-23',
 'Fail', 'Power component requires maintenance');


-- 10.MAINTENANCE_WORK_ORDER
INSERT INTO MAINTENANCE_WORK_ORDER
(WorkOrderID, AssetID, Description,
 OrderDate, Priority, Status)
VALUES
(701, 402,
 'Repair cooling system',
 '2026-09-20', 'High', 'InProgress'),
(702, 405,
 'Inspect hydraulic system',
 '2026-09-21', 'Medium', 'Closed'),
(703, 401,
 'Repair power subsystem',
 '2026-09-23', 'High', 'Open');


-- 11.MAINTENANCE_EVENT
INSERT INTO MAINTENANCE_EVENT
(MaintenanceID, WorkOrderID, Remarks,
 PerformedBy, StartDateTime, EndDateTime,
 MaintenanceType, ActionTaken,
 DowntimeHours, CostIncurred)
VALUES
(801, 702,'Hydraulic inspection completed', 103, '2026-09-21 16:00:00', '2026-09-21 18:00:00',
 'Inspection','Hydraulic system inspected',2.00,25000.00),
(802, 701,'Cooling system repair initiated',103,'2026-09-22 09:00:00','2026-09-22 15:30:00',
 'Repair','Cooling component replaced',6.50,85000.00);


--12. SUBSYSTEM
INSERT INTO SUBSYSTEM
(SubsystemID, SubsystemName, Description,
 CriticalityLevel, AssetID)
VALUES
(901, 'Engine System',
 'Primary propulsion subsystem',
 'High', 401),
(902, 'Cooling System',
 'Thermal management subsystem',
 'High', 402),
(903, 'Hydraulic System',
 'Hydraulic control subsystem',
 'High', 405),
(904, 'Power System',
 'Electrical power subsystem',
 'High', 401);


-- 13.COMPONENT
INSERT INTO COMPONENT
(ComponentID, ComponentName, Description,
 CriticalityLevel, IsRepairable, SubsystemID)
VALUES
(1001, 'Fuel Pump',
 'Synthetic fuel delivery component',
 'High', 'Yes', 901),
(1002, 'Engine Control Unit',
 'Synthetic engine control component',
 'High', 'Yes', 901),
(1003, 'Cooling Pump',
 'Synthetic cooling component',
 'High', 'Yes', 902),
(1004, 'Hydraulic Valve',
 'Synthetic hydraulic control component',
 'High', 'Yes', 903),
(1005, 'Power Controller',
 'Synthetic electrical control component',
 'High', 'Yes', 904);


-- 14.COMPONENT_DEPENDENCY
INSERT INTO COMPONENT_DEPENDENCY
(ComponentID, DependsOnComponentID)
VALUES
(1002, 1001),
(1003, 1001),
(1005, 1002);


-- 15.SPARE_PART
INSERT INTO SPARE_PART
(SparePartID, PartName, PartNumber,
 UOM, StockQuantity, ReorderLevel,
 UnitCost, CriticalityLevel)
VALUES
(1101, 'Fuel Pump Seal', 'FPS-001',
 'Piece', 50, 10, 5000.00, 'High'),
(1102, 'Cooling Pump Assembly', 'CPA-002',
 'Piece', 8, 3, 85000.00, 'High'),
(1103, 'Hydraulic Valve Kit', 'HVK-003',
 'Kit', 15, 5, 25000.00, 'Medium'),
(1104, 'Power Controller Module', 'PCM-004',
 'Piece', 6, 2, 120000.00, 'High');


-- 16.COMPONENT_SPARE
INSERT INTO COMPONENT_SPARE
(ComponentID, SparePartID, QuantityRequired, IsCritical)
VALUES
(1001, 1101, 2, 'Yes'),
(1003, 1102, 1, 'Yes'),
(1004, 1103, 1, 'Yes'),
(1005, 1104, 1, 'Yes');


-- 17.SUPPLIER
INSERT INTO SUPPLIER
(SupplierID, SupplierName, ContactPerson,
 Phone, Email, Address)
VALUES
(1201, 'Bharat Defence Components',
 'Rohan Mehta',
 '9000012001',
 'supplier1@example.com',
 'Bengaluru'),
(1202, 'Aero Systems Manufacturing',
 'Neha Rao',
 '9000012002',
 'supplier2@example.com',
 'Hyderabad'),
(1203, 'Precision Engineering Works',
 'Amit Kumar',
 '9000012003',
 'supplier3@example.com',
 'Pune');


--18. SUPPLIER_SPARE
INSERT INTO SUPPLIER_SPARE
(SupplierID, SparePartID, LeadTimeDay,
 UnitPrice, PreferredSupplier)
VALUES
(1201, 1101, 7, 5000.00, 'Yes'),
(1202, 1102, 14, 85000.00, 'Yes'),
(1203, 1103, 10, 25000.00, 'No'),
(1202, 1104, 21, 120000.00, 'Yes');


/*==============
   PART 2: UPDATE
===============*/


-- 1. Update asset status 

UPDATE ASSET
SET Status = 'Degraded'
WHERE AssetID = 401;


-- 2. Update maintenance work order 

UPDATE MAINTENANCE_WORK_ORDER
SET Status = 'Completed'
WHERE WorkOrderID = 701;


-- 3. Update spare stock 

UPDATE SPARE_PART
SET StockQuantity = StockQuantity - 2
WHERE SparePartID = 1101;


-- 4. Update supplier preference 

UPDATE SUPPLIER_SPARE
SET PreferredSupplier = 'Yes'
WHERE SupplierID = 1203
AND SparePartID = 1103;


/* ===============
   PART 3: DELETE
   ================*/

 --  Delete a dependency relationship.
DELETE FROM COMPONENT_DEPENDENCY
WHERE ComponentID = 1005
AND DependsOnComponentID = 1002;


--  Delete a supplier-spare relationship.
DELETE FROM SUPPLIER_SPARE
WHERE SupplierID = 1203
AND SparePartID = 1103;


/* ============================
   PART 4: BASIC SELECT QUERIES
   =============================*/

-- 1. Display all assets 
SELECT *
FROM ASSET;


-- 2. Display only unavailable assets 
SELECT AssetID, AssetName, Status
FROM ASSET
WHERE Status = 'Unavailable';


-- 3. Display high-criticality assets 
SELECT AssetID, AssetName, CriticalityLevel
FROM ASSET
WHERE CriticalityLevel = 'High';


-- 4. Display assets ordered by manufacturing year 
SELECT AssetName, MnfYear
FROM ASSET
ORDER BY MnfYear DESC;


-- 5. Display different asset statuses 
SELECT DISTINCT Status
FROM ASSET;


/* =============================
   PART 5: AGGREGATE FUNCTIONS
   ==============================*/


-- 1. Count total assets 
SELECT COUNT(*) AS TotalAssets
FROM ASSET;


-- 2. Average maintenance cost 
SELECT AVG(CostIncurred) AS AverageMaintenanceCost
FROM MAINTENANCE_EVENT;


-- 3. Total maintenance cost 
SELECT SUM(CostIncurred) AS TotalMaintenanceCost
FROM MAINTENANCE_EVENT;


-- 4. Maximum downtime 
SELECT MAX(DowntimeHours) AS MaximumDowntime
FROM MAINTENANCE_EVENT;


-- 5. Minimum maintenance cost 
SELECT MIN(CostIncurred) AS MinimumMaintenanceCost
FROM MAINTENANCE_EVENT;


/* ===================
   PART 6: GROUP BY
   ====================*/

-- Number of assets by status 
SELECT Status, COUNT(*) AS AssetCount
FROM ASSET
GROUP BY Status;


-- Number of assets by criticality 
SELECT CriticalityLevel, COUNT(*) AS AssetCount
FROM ASSET
GROUP BY CriticalityLevel;


-- Total maintenance cost by maintenance type 
SELECT MaintenanceType,
       SUM(CostIncurred) AS TotalCost
FROM MAINTENANCE_EVENT
GROUP BY MaintenanceType;


/* =======================
   PART 7: HAVING
   ========================*/


-- Asset statuses having more than one asset 
SELECT Status, COUNT(*) AS AssetCount
FROM ASSET
GROUP BY Status
HAVING COUNT(*) > 1;


-- Maintenance types with total cost greater than 50000 
SELECT MaintenanceType,
       SUM(CostIncurred) AS TotalCost
FROM MAINTENANCE_EVENT
GROUP BY MaintenanceType
HAVING SUM(CostIncurred) > 50000;


/* ======================
   PART 8: JOINS
   =======================*/


-- 1. Asset + Unit 
SELECT
    a.AssetName,
    u.UnitName,
    u.Location
FROM ASSET a
JOIN UNIT u
    ON a.UnitID = u.UnitID;


-- 2. Asset + Unit + Service 
SELECT
    a.AssetName,
    u.UnitName,
    s.ServiceName
FROM ASSET a
JOIN UNIT u
    ON a.UnitID = u.UnitID
JOIN SERVICE s
    ON u.ServiceID = s.ServiceID;


-- 3. Asset + Subsystem 
SELECT
    a.AssetName,
    ss.SubsystemName,
    ss.CriticalityLevel
FROM ASSET a
JOIN SUBSYSTEM ss
    ON a.AssetID = ss.AssetID;


-- 4. Subsystem + Component 
SELECT
    ss.SubsystemName,
    c.ComponentName,
    c.CriticalityLevel
FROM SUBSYSTEM ss
JOIN COMPONENT c
    ON ss.SubsystemID = c.SubsystemID;


-- 5. Component + Spare Part 
SELECT
    c.ComponentName,
    sp.PartName,
    cs.QuantityRequired,
    cs.IsCritical
FROM COMPONENT c
JOIN COMPONENT_SPARE cs
    ON c.ComponentID = cs.ComponentID
JOIN SPARE_PART sp
    ON cs.SparePartID = sp.SparePartID;


-- 6. Spare Part + Supplier 
SELECT
    sp.PartName,
    su.SupplierName,
    ss.UnitPrice,
    ss.LeadTimeDay,
    ss.PreferredSupplier
FROM SPARE_PART sp
JOIN SUPPLIER_SPARE ss
    ON sp.SparePartID = ss.SparePartID
JOIN SUPPLIER su
    ON ss.SupplierID = su.SupplierID;


-- 7. Maintenance + User 
SELECT
    me.MaintenanceID,
    me.MaintenanceType,
    u.FullName AS PerformedBy,
    me.CostIncurred
FROM MAINTENANCE_EVENT me
JOIN `USER` u
    ON me.PerformedBy = u.UserID;


/* =============================
   PART 9: MULTIPLE-TABLE JOIN
   ==============================*/


-- Show complete asset hierarchy 
SELECT
    s.ServiceName,
    u.UnitName,
    a.AssetName,
    ss.SubsystemName,
    c.ComponentName
FROM SERVICE s
JOIN UNIT u
    ON s.ServiceID = u.ServiceID
JOIN ASSET a
    ON u.UnitID = a.UnitID
JOIN SUBSYSTEM ss
    ON a.AssetID = ss.AssetID
JOIN COMPONENT c
    ON ss.SubsystemID = c.SubsystemID;


/* ======================
   PART 10: SUBQUERIES
   =======================*/


-- 1. Assets having above-average maintenance cost 
SELECT DISTINCT a.AssetID, a.AssetName
FROM ASSET a
JOIN MAINTENANCE_WORK_ORDER wo
    ON a.AssetID = wo.AssetID
JOIN MAINTENANCE_EVENT me
    ON wo.WorkOrderID = me.WorkOrderID
WHERE me.CostIncurred >
(
    SELECT AVG(CostIncurred)
    FROM MAINTENANCE_EVENT
);


-- 2. Assets with at least one failure 
SELECT AssetID, AssetName
FROM ASSET
WHERE AssetID IN
(
    SELECT AssetID
    FROM FAILURE_EVENT
);


-- 3. Spare parts below reorder level 
SELECT SparePartID, PartName,
       StockQuantity, ReorderLevel
FROM SPARE_PART
WHERE StockQuantity <= ReorderLevel;


/* ================================
   PART 11: CORRELATED SUBQUERY
   =================================*/

 --Find spare parts whose stock is below their own reorder level.
SELECT sp1.SparePartID,
       sp1.PartName,
       sp1.StockQuantity,
       sp1.ReorderLevel
FROM SPARE_PART sp1
WHERE sp1.StockQuantity <=
      sp1.ReorderLevel;


/* ============================
   PART 12: SET OPERATIONS
   =============================*/


-- Assets that are Ready or Degraded 
SELECT AssetName
FROM ASSET
WHERE Status = 'Ready'
UNION
SELECT AssetName
FROM ASSET
WHERE Status = 'Degraded';


/* ========================
   PART 13: VIEW
   ========================= */


-- View for asset readiness information.
CREATE OR REPLACE VIEW asset_readiness_view AS
SELECT
    a.AssetID,
    a.AssetName,
    a.Status,
    a.CriticalityLevel,
    u.UnitName,
    s.ServiceName
FROM ASSET a
JOIN UNIT u
    ON a.UnitID = u.UnitID
JOIN SERVICE s
    ON u.ServiceID = s.ServiceID;


-- Use the view 
SELECT *
FROM asset_readiness_view;


/* ========================
   PART 14: INDEXES
   ========================= */


-- Frequently searched asset status 
CREATE INDEX idx_asset_status
ON ASSET(Status);


-- Frequently searched component criticality 
CREATE INDEX idx_component_criticality
ON COMPONENT(CriticalityLevel);


-- Failure lookup by asset 
CREATE INDEX idx_failure_asset
ON FAILURE_EVENT(AssetID);


-- Maintenance lookup by work order 
CREATE INDEX idx_maintenance_workorder
ON MAINTENANCE_EVENT(WorkOrderID);


/* ==============================
   PART 15: TRANSACTION
   ===============================*/


/*
   Example:
   Maintenance consumes spare parts.
   Both stock update and maintenance record
   should succeed together.
*/

START TRANSACTION;
UPDATE SPARE_PART
SET StockQuantity = StockQuantity - 2
WHERE SparePartID = 1101
AND StockQuantity >= 2;

COMMIT;


/*
   If something goes wrong:

   ROLLBACK;
*/


/* ============================
   PART 16: TRIGGER
   =============================*/

-- Readiness is derived only from recorded work-order status. This rule cannot
-- account for unresolved failures because FAILURE_EVENT has no resolution status.
-- It is not concurrency-safe across simultaneous work-order changes.
DROP TRIGGER IF EXISTS trg_asset_repair_status;
DROP TRIGGER IF EXISTS trg_work_order_asset_unavailable_after_insert;
DROP TRIGGER IF EXISTS trg_work_order_asset_status_after_update;
DROP TRIGGER IF EXISTS trg_work_order_asset_status_after_delete;
DROP TRIGGER IF EXISTS trg_maintenance_event_require_cost_before_insert;
DROP TRIGGER IF EXISTS trg_maintenance_event_require_cost_before_update;

DELIMITER //

CREATE TRIGGER trg_work_order_asset_unavailable_after_insert
AFTER INSERT ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  IF NEW.Status IN ('Open', 'InProgress') THEN
    UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
  END IF;
END//

CREATE TRIGGER trg_work_order_asset_status_after_update
AFTER UPDATE ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  DECLARE v_active_orders BIGINT DEFAULT 0;

  IF NOT (OLD.AssetID <=> NEW.AssetID) THEN
    IF OLD.Status IN ('Open', 'InProgress') THEN
      SELECT COUNT(*) INTO v_active_orders
      FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = OLD.AssetID AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = OLD.AssetID;
    END IF;

    IF NEW.Status IN ('Open', 'InProgress') THEN
      UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
    ELSEIF NOT (OLD.Status <=> NEW.Status)
       AND NEW.Status IN ('Completed', 'Closed') THEN
      SELECT COUNT(*) INTO v_active_orders
      FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = NEW.AssetID AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = NEW.AssetID;
    END IF;
  ELSEIF NOT (OLD.Status <=> NEW.Status) THEN
    IF NEW.Status IN ('Open', 'InProgress') THEN
      UPDATE ASSET SET Status = 'Unavailable' WHERE AssetID = NEW.AssetID;
    ELSEIF NEW.Status IN ('Completed', 'Closed') THEN
      SELECT COUNT(*) INTO v_active_orders
      FROM MAINTENANCE_WORK_ORDER
      WHERE AssetID = NEW.AssetID
        AND WorkOrderID <> NEW.WorkOrderID
        AND Status IN ('Open', 'InProgress');
      UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
      WHERE AssetID = NEW.AssetID;
    END IF;
  END IF;
END//

CREATE TRIGGER trg_work_order_asset_status_after_delete
AFTER DELETE ON MAINTENANCE_WORK_ORDER
FOR EACH ROW
BEGIN
  DECLARE v_active_orders BIGINT DEFAULT 0;
  IF OLD.Status IN ('Open', 'InProgress') THEN
    SELECT COUNT(*) INTO v_active_orders
    FROM MAINTENANCE_WORK_ORDER
    WHERE AssetID = OLD.AssetID AND Status IN ('Open', 'InProgress');
    UPDATE ASSET SET Status = CASE WHEN v_active_orders = 0 THEN 'Ready' ELSE 'Unavailable' END
    WHERE AssetID = OLD.AssetID;
  END IF;
END//

CREATE TRIGGER trg_maintenance_event_require_cost_before_insert
BEFORE INSERT ON MAINTENANCE_EVENT
FOR EACH ROW
BEGIN
  IF NEW.CostIncurred IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred is required for a new maintenance event.';
  END IF;
END//

CREATE TRIGGER trg_maintenance_event_require_cost_before_update
BEFORE UPDATE ON MAINTENANCE_EVENT
FOR EACH ROW
BEGIN
  IF NEW.CostIncurred IS NULL AND OLD.CostIncurred IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CostIncurred cannot be set to NULL.';
  END IF;
END//

DELIMITER ;


/* ====================================
   PART 17: STORED FUNCTION
   =====================================*/

/*
   Returns the number of failures for an asset.
*/

DROP FUNCTION IF EXISTS get_failure_count;

DELIMITER $$

CREATE FUNCTION get_failure_count(
    p_asset_id INT
)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE failure_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO failure_count
    FROM FAILURE_EVENT
    WHERE AssetID = p_asset_id;

    RETURN failure_count;
END$$

DELIMITER ;


-- Call the function 

SELECT get_failure_count(401);


/* ====================================
   PART 18: STORED PROCEDURE
   =====================================*/

/*
   Updates the status of an asset.
*/
DROP PROCEDURE IF EXISTS update_asset_status;
DELIMITER $$
CREATE PROCEDURE update_asset_status(
    IN p_asset_id INT,
    IN p_status VARCHAR(50)
)
BEGIN
    UPDATE ASSET
    SET Status = p_status
    WHERE AssetID = p_asset_id;
END$$
DELIMITER ;


-- Call procedure 
CALL update_asset_status(401, 'Ready');


/* ========================
   PART 19: CTE
   =========================*/


/*
   Calculate total maintenance cost
   for each work order.
*/

WITH MaintenanceSummary AS
(
    SELECT
        WorkOrderID,
        SUM(CostIncurred) AS TotalCost
    FROM MAINTENANCE_EVENT
    GROUP BY WorkOrderID
)
SELECT *
FROM MaintenanceSummary
ORDER BY TotalCost DESC;


/* ==================================
   PART 20: WINDOW FUNCTION
   ===================================*/


/*
   Rank maintenance events by cost.
*/

SELECT
    MaintenanceID,
    MaintenanceType,
    CostIncurred,
    RANK() OVER
    (
        ORDER BY CostIncurred DESC
    ) AS CostRank
FROM MAINTENANCE_EVENT;


/* =====================================
   PART 21: USEFUL PROJECT QUERY
   ======================================*/
--1. Find unavailable or degraded assets and their latest known failure.
SELECT
    a.AssetID,
    a.AssetName,
    a.Status,
    f.FailureType,
    f.Severity,
    f.OccurredAt
FROM ASSET a
JOIN FAILURE_EVENT f
    ON a.AssetID = f.AssetID
WHERE a.Status IN ('Unavailable', 'Degraded')
ORDER BY f.OccurredAt DESC;



-- 2.   Find critical components and the spare parts they require.
SELECT
    c.ComponentName,
    c.CriticalityLevel,
    sp.PartName,
    sp.StockQuantity,
    sp.ReorderLevel
FROM COMPONENT c
JOIN COMPONENT_SPARE cs
    ON c.ComponentID = cs.ComponentID
JOIN SPARE_PART sp
    ON cs.SparePartID = sp.SparePartID
WHERE c.CriticalityLevel = 'High';



-- 3.   Find components whose required spare parts are below reorder level.
SELECT
    c.ComponentName,
    sp.PartName,
    sp.StockQuantity,
    sp.ReorderLevel
FROM COMPONENT c
JOIN COMPONENT_SPARE cs
    ON c.ComponentID = cs.ComponentID
JOIN SPARE_PART sp
    ON cs.SparePartID = sp.SparePartID
WHERE sp.StockQuantity <= sp.ReorderLevel;



-- 4. Find component dependencies.
SELECT
    c1.ComponentName AS Component,
    c2.ComponentName AS DependsOn
FROM COMPONENT_DEPENDENCY cd
JOIN COMPONENT c1
    ON cd.ComponentID = c1.ComponentID
JOIN COMPONENT c2
    ON cd.DependsOnComponentID = c2.ComponentID;
