export type AssetSummary = {
  AssetID: number;
  AssetName: string;
  IdentificationNo: string | null;
  Model: string | null;
  MnfYear: number | null;
  Status: string | null;
  CriticalityLevel: string | null;
  UnitName: string;
  ServiceName: string;
};

export type WorkOrder = {
  WorkOrderID: number;
  AssetID: number;
  AssetName: string;
  Description: string | null;
  OrderDate: string | null;
  Priority: string | null;
  Status: string | null;
};

export type SparePart = {
  SparePartID: number;
  PartName: string;
  PartNumber: string | null;
  StockQuantity: number | null;
  ReorderLevel: number | null;
  CriticalityLevel: string | null;
};
