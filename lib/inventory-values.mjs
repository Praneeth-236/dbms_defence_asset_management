export function calculateStockAdjustment(currentStock, adjustment) {
  if (currentStock === null) return { ok: false, reason: "STOCK_UNSPECIFIED" };
  if (!Number.isSafeInteger(currentStock) || currentStock < 0 || !Number.isSafeInteger(adjustment)) {
    return { ok: false, reason: "INVALID_STOCK" };
  }

  const stockQuantity = currentStock + adjustment;
  if (!Number.isSafeInteger(stockQuantity)) return { ok: false, reason: "INVALID_STOCK" };
  if (stockQuantity < 0) return { ok: false, reason: "INSUFFICIENT_STOCK" };
  return { ok: true, stockQuantity };
}

export function displayStockQuantity(value) {
  return value === null ? "Unspecified" : value;
}

export function displayReorderLevel(value) {
  return value === null ? "Unspecified" : value;
}

export function displayMaintenanceCost(value) {
  return value === null ? "No cost recorded" : value;
}

export function displayWorkOrderStatus(value) {
  return value === null ? "Unspecified" : value;
}

export function isForeignKeyRestriction(error) {
  return Boolean(error && typeof error === "object" &&
    (error.errno === 1451 || error.code === "ER_ROW_IS_REFERENCED_2"));
}
