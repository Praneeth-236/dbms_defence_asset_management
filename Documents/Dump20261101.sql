-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: defence_asset_system
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `asset`
--

DROP TABLE IF EXISTS `asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset` (
  `AssetID` int NOT NULL,
  `AssetName` varchar(100) NOT NULL,
  `IdentificationNo` varchar(100) DEFAULT NULL,
  `Model` varchar(100) DEFAULT NULL,
  `MnfYear` int DEFAULT NULL,
  `Status` varchar(30) DEFAULT NULL,
  `CriticalityLevel` varchar(20) DEFAULT NULL,
  `UnitID` int NOT NULL,
  `AssetTypeID` int NOT NULL,
  PRIMARY KEY (`AssetID`),
  KEY `UnitID` (`UnitID`),
  KEY `AssetTypeID` (`AssetTypeID`),
  KEY `idx_asset_status` (`Status`),
  CONSTRAINT `asset_ibfk_1` FOREIGN KEY (`UnitID`) REFERENCES `unit` (`UnitID`),
  CONSTRAINT `asset_ibfk_2` FOREIGN KEY (`AssetTypeID`) REFERENCES `asset_type` (`AssetTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `asset_readiness_view`
--

DROP TABLE IF EXISTS `asset_readiness_view`;
/*!50001 DROP VIEW IF EXISTS `asset_readiness_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `asset_readiness_view` AS SELECT 
 1 AS `AssetID`,
 1 AS `AssetName`,
 1 AS `Status`,
 1 AS `CriticalityLevel`,
 1 AS `UnitName`,
 1 AS `ServiceName`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `asset_type`
--

DROP TABLE IF EXISTS `asset_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_type` (
  `AssetTypeID` int NOT NULL,
  `AssetTypeName` varchar(100) NOT NULL,
  `Category` varchar(100) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`AssetTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component`
--

DROP TABLE IF EXISTS `component`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component` (
  `ComponentID` int NOT NULL,
  `ComponentName` varchar(100) NOT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `CriticalityLevel` varchar(20) DEFAULT NULL,
  `IsRepairable` varchar(5) DEFAULT NULL,
  `SubsystemID` int NOT NULL,
  PRIMARY KEY (`ComponentID`),
  KEY `SubsystemID` (`SubsystemID`),
  KEY `idx_component_criticality` (`CriticalityLevel`),
  CONSTRAINT `component_ibfk_1` FOREIGN KEY (`SubsystemID`) REFERENCES `subsystem` (`SubsystemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component_dependency`
--

DROP TABLE IF EXISTS `component_dependency`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_dependency` (
  `ComponentID` int NOT NULL,
  `DependsOnComponentID` int NOT NULL,
  PRIMARY KEY (`ComponentID`,`DependsOnComponentID`),
  KEY `DependsOnComponentID` (`DependsOnComponentID`),
  CONSTRAINT `component_dependency_ibfk_1` FOREIGN KEY (`ComponentID`) REFERENCES `component` (`ComponentID`),
  CONSTRAINT `component_dependency_ibfk_2` FOREIGN KEY (`DependsOnComponentID`) REFERENCES `component` (`ComponentID`),
  CONSTRAINT `component_dependency_chk_1` CHECK ((`ComponentID` <> `DependsOnComponentID`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component_spare`
--

DROP TABLE IF EXISTS `component_spare`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_spare` (
  `ComponentID` int NOT NULL,
  `SparePartID` int NOT NULL,
  `QuantityRequired` int DEFAULT NULL,
  `IsCritical` varchar(5) DEFAULT NULL,
  PRIMARY KEY (`ComponentID`,`SparePartID`),
  KEY `SparePartID` (`SparePartID`),
  CONSTRAINT `component_spare_ibfk_1` FOREIGN KEY (`ComponentID`) REFERENCES `component` (`ComponentID`),
  CONSTRAINT `component_spare_ibfk_2` FOREIGN KEY (`SparePartID`) REFERENCES `spare_part` (`SparePartID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `country`
--

DROP TABLE IF EXISTS `country`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `country` (
  `CountryID` int NOT NULL,
  `CountryName` varchar(100) NOT NULL,
  `Region` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`CountryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `defence_indicator`
--

DROP TABLE IF EXISTS `defence_indicator`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `defence_indicator` (
  `IndicatorID` int NOT NULL,
  `CountryID` int NOT NULL,
  `Year` int NOT NULL,
  `DefenceBudget` decimal(15,2) DEFAULT NULL,
  `RevenueExpenditure` decimal(15,2) DEFAULT NULL,
  `CapitalExp` decimal(15,2) DEFAULT NULL,
  `MaintenanceExp` decimal(15,2) DEFAULT NULL,
  `IndigenisationIndex` decimal(5,2) DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`IndicatorID`),
  KEY `CountryID` (`CountryID`),
  CONSTRAINT `defence_indicator_ibfk_1` FOREIGN KEY (`CountryID`) REFERENCES `country` (`CountryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `failure_event`
--

DROP TABLE IF EXISTS `failure_event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failure_event` (
  `FailureID` int NOT NULL,
  `FailureType` varchar(100) DEFAULT NULL,
  `Severity` varchar(20) DEFAULT NULL,
  `OccurredAt` datetime DEFAULT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `AssetID` int NOT NULL,
  PRIMARY KEY (`FailureID`),
  KEY `idx_failure_asset` (`AssetID`),
  CONSTRAINT `failure_event_ibfk_1` FOREIGN KEY (`AssetID`) REFERENCES `asset` (`AssetID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inspection`
--

DROP TABLE IF EXISTS `inspection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inspection` (
  `InspectionID` int NOT NULL,
  `FailureID` int NOT NULL,
  `InspectorID` int NOT NULL,
  `InspectionType` varchar(100) DEFAULT NULL,
  `InspectionDate` date DEFAULT NULL,
  `Result` varchar(50) DEFAULT NULL,
  `Remarks` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`InspectionID`),
  KEY `FailureID` (`FailureID`),
  KEY `InspectorID` (`InspectorID`),
  CONSTRAINT `inspection_ibfk_1` FOREIGN KEY (`FailureID`) REFERENCES `failure_event` (`FailureID`),
  CONSTRAINT `inspection_ibfk_2` FOREIGN KEY (`InspectorID`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `maintenance_event`
--

DROP TABLE IF EXISTS `maintenance_event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenance_event` (
  `MaintenanceID` int NOT NULL,
  `WorkOrderID` int NOT NULL,
  `Remarks` varchar(500) DEFAULT NULL,
  `PerformedBy` int NOT NULL,
  `StartDateTime` datetime DEFAULT NULL,
  `EndDateTime` datetime DEFAULT NULL,
  `MaintenanceType` varchar(50) DEFAULT NULL,
  `ActionTaken` varchar(500) DEFAULT NULL,
  `DowntimeHours` decimal(10,2) DEFAULT NULL,
  `CostIncurred` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`MaintenanceID`),
  KEY `PerformedBy` (`PerformedBy`),
  KEY `idx_maintenance_workorder` (`WorkOrderID`),
  CONSTRAINT `maintenance_event_ibfk_1` FOREIGN KEY (`WorkOrderID`) REFERENCES `maintenance_work_order` (`WorkOrderID`),
  CONSTRAINT `maintenance_event_ibfk_2` FOREIGN KEY (`PerformedBy`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_asset_repair_status` AFTER INSERT ON `maintenance_event` FOR EACH ROW BEGIN
    IF NEW.MaintenanceType = 'Repair' THEN
        UPDATE asset
        SET Status = 'Ready'
        WHERE AssetID = (
            SELECT AssetID
            FROM maintenance_work_order
            WHERE WorkOrderID = NEW.WorkOrderID
        );
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `maintenance_work_order`
--

DROP TABLE IF EXISTS `maintenance_work_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenance_work_order` (
  `WorkOrderID` int NOT NULL,
  `AssetID` int NOT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `OrderDate` date DEFAULT NULL,
  `Priority` varchar(20) DEFAULT NULL,
  `Status` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`WorkOrderID`),
  KEY `AssetID` (`AssetID`),
  CONSTRAINT `maintenance_work_order_ibfk_1` FOREIGN KEY (`AssetID`) REFERENCES `asset` (`AssetID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service`
--

DROP TABLE IF EXISTS `service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service` (
  `ServiceID` int NOT NULL,
  `ServiceName` varchar(100) NOT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `CountryID` int NOT NULL,
  PRIMARY KEY (`ServiceID`),
  KEY `CountryID` (`CountryID`),
  CONSTRAINT `service_ibfk_1` FOREIGN KEY (`CountryID`) REFERENCES `country` (`CountryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `spare_part`
--

DROP TABLE IF EXISTS `spare_part`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `spare_part` (
  `SparePartID` int NOT NULL,
  `PartName` varchar(100) NOT NULL,
  `PartNumber` varchar(100) DEFAULT NULL,
  `UOM` varchar(30) DEFAULT NULL,
  `StockQuantity` int DEFAULT '0',
  `ReorderLevel` int DEFAULT '0',
  `UnitCost` decimal(12,2) DEFAULT NULL,
  `CriticalityLevel` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`SparePartID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subsystem`
--

DROP TABLE IF EXISTS `subsystem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subsystem` (
  `SubsystemID` int NOT NULL,
  `SubsystemName` varchar(100) NOT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `CriticalityLevel` varchar(20) DEFAULT NULL,
  `AssetID` int NOT NULL,
  PRIMARY KEY (`SubsystemID`),
  KEY `AssetID` (`AssetID`),
  CONSTRAINT `subsystem_ibfk_1` FOREIGN KEY (`AssetID`) REFERENCES `asset` (`AssetID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supplier`
--

DROP TABLE IF EXISTS `supplier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier` (
  `SupplierID` int NOT NULL,
  `SupplierName` varchar(100) NOT NULL,
  `ContactPerson` varchar(100) DEFAULT NULL,
  `Phone` varchar(20) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Address` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`SupplierID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supplier_spare`
--

DROP TABLE IF EXISTS `supplier_spare`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_spare` (
  `SupplierID` int NOT NULL,
  `SparePartID` int NOT NULL,
  `LeadTimeDay` int DEFAULT NULL,
  `UnitPrice` decimal(12,2) DEFAULT NULL,
  `PreferredSupplier` varchar(5) DEFAULT NULL,
  PRIMARY KEY (`SupplierID`,`SparePartID`),
  KEY `SparePartID` (`SparePartID`),
  CONSTRAINT `supplier_spare_ibfk_1` FOREIGN KEY (`SupplierID`) REFERENCES `supplier` (`SupplierID`),
  CONSTRAINT `supplier_spare_ibfk_2` FOREIGN KEY (`SparePartID`) REFERENCES `spare_part` (`SparePartID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unit`
--

DROP TABLE IF EXISTS `unit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unit` (
  `UnitID` int NOT NULL,
  `UnitName` varchar(100) NOT NULL,
  `Type` varchar(50) DEFAULT NULL,
  `Location` varchar(100) DEFAULT NULL,
  `ServiceID` int NOT NULL,
  PRIMARY KEY (`UnitID`),
  KEY `ServiceID` (`ServiceID`),
  CONSTRAINT `unit_ibfk_1` FOREIGN KEY (`ServiceID`) REFERENCES `service` (`ServiceID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `UserID` int NOT NULL,
  `UserName` varchar(50) NOT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `FullName` varchar(100) DEFAULT NULL,
  `Role` varchar(30) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Phone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'defence_asset_system'
--
/*!50003 DROP FUNCTION IF EXISTS `get_failure_count` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` FUNCTION `get_failure_count`(
    p_asset_id INT
) RETURNS int
    READS SQL DATA
    DETERMINISTIC
BEGIN
    DECLARE failure_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO failure_count
    FROM FAILURE_EVENT
    WHERE AssetID = p_asset_id;

    RETURN failure_count;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `update_asset_status` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `update_asset_status`(
    IN p_asset_id INT,
    IN p_status VARCHAR(50)
)
BEGIN
    UPDATE ASSET
    SET Status = p_status
    WHERE AssetID = p_asset_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `asset_readiness_view`
--

/*!50001 DROP VIEW IF EXISTS `asset_readiness_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `asset_readiness_view` AS select `a`.`AssetID` AS `AssetID`,`a`.`AssetName` AS `AssetName`,`a`.`Status` AS `Status`,`a`.`CriticalityLevel` AS `CriticalityLevel`,`u`.`UnitName` AS `UnitName`,`s`.`ServiceName` AS `ServiceName` from ((`asset` `a` join `unit` `u` on((`a`.`UnitID` = `u`.`UnitID`))) join `service` `s` on((`u`.`ServiceID` = `s`.`ServiceID`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 21:51:04
