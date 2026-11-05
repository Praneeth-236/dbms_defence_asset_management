# Normalization and Design Analysis

## Scope

This analysis uses the verified MySQL export `Dump20261101.sql`. It does not
change the existing schema.

## Relations and keys

The schema contains entity relations for countries, services, units, asset
types, assets, subsystems, components, spare parts, suppliers, users, failures,
inspections, work orders, and maintenance events. Relationship relations are
`COMPONENT_DEPENDENCY`, `COMPONENT_SPARE`, and `SUPPLIER_SPARE`.

The relationship tables have composite primary keys:

- `COMPONENT_DEPENDENCY(ComponentID, DependsOnComponentID)`
- `COMPONENT_SPARE(ComponentID, SparePartID)`
- `SUPPLIER_SPARE(SupplierID, SparePartID)`

All other exported tables have a single-column primary key.

## Functional dependencies

The following dependencies are guaranteed by the exported primary keys:

- `CountryID -> CountryName, Region`
- `ServiceID -> ServiceName, Description, CountryID`
- `UnitID -> UnitName, Type, Location, ServiceID`
- `AssetID -> AssetName, IdentificationNo, Model, MnfYear, Status, CriticalityLevel, UnitID, AssetTypeID`
- `SubsystemID -> SubsystemName, Description, CriticalityLevel, AssetID`
- `ComponentID -> ComponentName, Description, CriticalityLevel, IsRepairable, SubsystemID`
- `SparePartID -> PartName, PartNumber, UOM, StockQuantity, ReorderLevel, UnitCost, CriticalityLevel`
- `SupplierID -> SupplierName, ContactPerson, Phone, Email, Address`
- `FailureID -> FailureType, Severity, OccurredAt, Description, AssetID`
- `WorkOrderID -> AssetID, Description, OrderDate, Priority, Status`
- `MaintenanceID -> WorkOrderID, Remarks, PerformedBy, StartDateTime, EndDateTime, MaintenanceType, ActionTaken, DowntimeHours, CostIncurred`

For relationship tables, the full composite key determines the relationship
attributes:

- `(ComponentID, SparePartID) -> QuantityRequired, IsCritical`
- `(SupplierID, SparePartID) -> LeadTimeDay, UnitPrice, PreferredSupplier`

These are key-based dependencies read directly from the exported schema. The
export does not declare alternate keys for `Email`, `PartNumber`,
`IdentificationNo`, or any descriptive name, so dependencies based on those
attributes are business assumptions rather than enforced schema facts.

## Normal forms

- **1NF:** The exported columns are scalar and no repeating groups are
  represented in a single row.
- **2NF:** Entity tables use single-attribute keys. Relationship tables place
  relationship attributes on the full composite key; no partial dependency is
  visible.
- **3NF:** Under the key-based dependencies above, non-key attributes depend on
  their relation's key. Referenced entities such as country, service, unit,
  asset, subsystem, and component are decomposed into separate relations,
  preventing the corresponding transitive duplication.
- **BCNF:** Under the dependencies guaranteed by the exported schema, the
  relations satisfy BCNF because every declared determinant is a candidate
  key. This conclusion does not include unenforced business rules that might
  make email, part number, or identification number alternate keys.

## Lossless decomposition and dependency preservation

The decomposition is lossless for the documented foreign-key joins because
each child relation retains the determinant foreign key and each parent
relation retains its primary key. The principal key-based functional
dependencies are preserved inside their owning relations. Foreign keys
preserve the inter-relation identity dependencies; they do not by themselves
establish additional functional dependencies on non-key attributes.

## Design limitations found in the export

The export does not define UNIQUE or CHECK constraints for many domain values.
For example, status, severity, criticality, stock non-negativity, and date
ordering are mostly represented by unconstrained nullable strings/numbers.
This is documented as a schema limitation rather than changed, because the
project requires preservation of the existing schema.
