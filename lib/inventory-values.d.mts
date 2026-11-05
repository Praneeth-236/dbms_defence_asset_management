export type StockAdjustmentResult =
  | { ok: true; stockQuantity: number }
  | { ok: false; reason: "STOCK_UNSPECIFIED" | "INSUFFICIENT_STOCK" | "INVALID_STOCK" };

export function calculateStockAdjustment(currentStock: number | null, adjustment: number): StockAdjustmentResult;
export function displayStockQuantity(value: number | null): number | "Unspecified";
export function displayReorderLevel(value: number | null): number | "Unspecified";
export function displayMaintenanceCost(value: number | string | null): number | string | "No cost recorded";
export function displayWorkOrderStatus(value: string | null): string;
export function isForeignKeyRestriction(error: unknown): boolean;
