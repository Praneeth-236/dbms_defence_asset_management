import { query } from "../../lib/db";
import type { SparePart } from "../../lib/types";
import type { RowDataPacket } from "mysql2/promise";
import InventoryManager from "./inventory-manager";
import { currentSession, hasRole } from "../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  let parts: (SparePart & RowDataPacket)[] = [];
  try {
    parts = await cached("inventory:spare-parts", () => query("(SELECT SparePartID, PartName, PartNumber, StockQuantity, ReorderLevel, CriticalityLevel FROM SPARE_PART ORDER BY (StockQuantity <= ReorderLevel) DESC, PartName)"), CACHE_TTL_SECONDS.operational, ["inventory"]);
  } catch {
    return <section className="error"><div className="eyebrow">Supply readiness</div><h1>Inventory unavailable</h1><p>Check the server environment and database connection.</p></section>;
  }
  return <><header className="page-heading route-heading"><div><div className="eyebrow">Supply readiness / logistics</div><h1>Inventory</h1><p className="muted">Monitor stock levels and protect maintenance continuity.</p></div><div className="heading-stamp"><span className="status-dot" aria-hidden="true" /> {parts.length} parts tracked</div></header><section className="reference-panel detail-table-card"><div className="reference-panel-title"><span className="panel-icon">▣</span><h2>Stock posture</h2><span className="heading-stamp">MySQL source</span></div><div className="table-wrap"><InventoryManager parts={parts} canManage={hasRole(await currentSession(), ["Admin"])} /></div></section></>;
}
