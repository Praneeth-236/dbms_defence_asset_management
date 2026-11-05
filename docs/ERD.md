# Defence Asset Readiness & Maintenance Dependency System ERD

This Mermaid ER diagram is derived from the verified MySQL schema export
[`Dump20261101.sql`](../Dump20261101.sql). It documents the existing tables,
keys, and foreign-key relationships; it does not create or alter database
objects.

```mermaid
erDiagram
    COUNTRY ||--o{ SERVICE : has
    COUNTRY ||--o{ DEFENCE_INDICATOR : reports
    SERVICE ||--o{ UNIT : contains
    UNIT ||--o{ ASSET : assigns
    ASSET_TYPE ||--o{ ASSET : classifies
    ASSET ||--o{ SUBSYSTEM : contains
    SUBSYSTEM ||--o{ COMPONENT : contains
    COMPONENT ||--o{ COMPONENT_DEPENDENCY : depends
    COMPONENT ||--o{ COMPONENT_DEPENDENCY : prerequisite
    COMPONENT ||--o{ COMPONENT_SPARE : requires
    SPARE_PART ||--o{ COMPONENT_SPARE : supports
    SUPPLIER ||--o{ SUPPLIER_SPARE : supplies
    SPARE_PART ||--o{ SUPPLIER_SPARE : sourced
    ASSET ||--o{ FAILURE_EVENT : records
    FAILURE_EVENT ||--o{ INSPECTION : receives
    USER ||--o{ INSPECTION : performs
    ASSET ||--o{ MAINTENANCE_WORK_ORDER : has
    MAINTENANCE_WORK_ORDER ||--o{ MAINTENANCE_EVENT : records
    USER ||--o{ MAINTENANCE_EVENT : performs

    COUNTRY {
        int CountryID PK
        varchar CountryName
        varchar Region
    }
    SERVICE {
        int ServiceID PK
        varchar ServiceName
        varchar Description
        int CountryID FK
    }
    UNIT {
        int UnitID PK
        varchar UnitName
        varchar Type
        varchar Location
        int ServiceID FK
    }
    ASSET_TYPE {
        int AssetTypeID PK
        varchar AssetTypeName
        varchar Category
        varchar Description
    }
    ASSET {
        int AssetID PK
        varchar AssetName
        varchar IdentificationNo
        varchar Model
        int MnfYear
        varchar Status
        varchar CriticalityLevel
        int UnitID FK
        int AssetTypeID FK
    }
    SUBSYSTEM {
        int SubsystemID PK
        varchar SubsystemName
        varchar Description
        varchar CriticalityLevel
        int AssetID FK
    }
    COMPONENT {
        int ComponentID PK
        varchar ComponentName
        varchar Description
        varchar CriticalityLevel
        varchar IsRepairable
        int SubsystemID FK
    }
    COMPONENT_DEPENDENCY {
        int ComponentID PK, FK
        int DependsOnComponentID PK, FK
    }
    SPARE_PART {
        int SparePartID PK
        varchar PartName
        varchar PartNumber
        varchar UOM
        int StockQuantity
        int ReorderLevel
        decimal UnitCost
        varchar CriticalityLevel
    }
    COMPONENT_SPARE {
        int ComponentID PK, FK
        int SparePartID PK, FK
        int QuantityRequired
        varchar IsCritical
    }
    SUPPLIER {
        int SupplierID PK
        varchar SupplierName
        varchar ContactPerson
        varchar Phone
        varchar Email
        varchar Address
    }
    SUPPLIER_SPARE {
        int SupplierID PK, FK
        int SparePartID PK, FK
        int LeadTimeDay
        decimal UnitPrice
        varchar PreferredSupplier
    }
    FAILURE_EVENT {
        int FailureID PK
        varchar FailureType
        varchar Severity
        datetime OccurredAt
        varchar Description
        int AssetID FK
    }
    INSPECTION {
        int InspectionID PK
        int FailureID FK
        int InspectorID FK
        varchar InspectionType
        date InspectionDate
        varchar Result
        varchar Remarks
    }
    MAINTENANCE_WORK_ORDER {
        int WorkOrderID PK
        int AssetID FK
        varchar Description
        date OrderDate
        varchar Priority
        varchar Status
    }
    MAINTENANCE_EVENT {
        int MaintenanceID PK
        int WorkOrderID FK
        varchar Remarks
        int PerformedBy FK
        datetime StartDateTime
        datetime EndDateTime
        varchar MaintenanceType
        varchar ActionTaken
        decimal DowntimeHours
        decimal CostIncurred
    }
    DEFENCE_INDICATOR {
        int IndicatorID PK
        int CountryID FK
        int Year
        decimal DefenceBudget
        decimal RevenueExpenditure
        decimal CapitalExp
        decimal MaintenanceExp
        decimal IndigenisationIndex
        varchar Notes
    }
    USER {
        int UserID PK
        varchar UserName
        varchar PasswordHash
        varchar FullName
        varchar Role
        varchar Email
        varchar Phone
    }
```

`USER` is shown as an entity name for readability; SQL statements must quote
the table as `` `USER` `` where required by MySQL.
