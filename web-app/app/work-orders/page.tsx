import { query } from "../../lib/db";
import type { WorkOrder } from "../../lib/types";
import type { RowDataPacket } from "mysql2/promise";
import NewWorkOrderForm from "./new-work-order-form";
import WorkOrderManager from "./work-order-manager";
import { currentSession, roleAllowed } from "../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  let orders: (WorkOrder & RowDataPacket)[] = [];
  let assets: ({ AssetID: number; AssetName: string } & RowDataPacket)[] = [];
  try {
    [orders, assets] = await Promise.all([
      cached("work-orders:list", () => query<(WorkOrder & RowDataPacket)[]>("SELECT wo.WorkOrderID, wo.AssetID, a.AssetName, wo.Description, wo.OrderDate, wo.Priority, wo.Status FROM MAINTENANCE_WORK_ORDER wo JOIN ASSET a ON a.AssetID = wo.AssetID ORDER BY wo.OrderDate DESC, wo.WorkOrderID DESC LIMIT 200"), CACHE_TTL_SECONDS.operational, ["work-orders", "assets"]),
      cached("work-orders:asset-options", () => query<({ AssetID: number; AssetName: string } & RowDataPacket)[]>("SELECT AssetID, AssetName FROM ASSET ORDER BY AssetName LIMIT 500"), CACHE_TTL_SECONDS.operational, ["assets"])
    ]);
  } catch {
    return <section className="error"><div className="eyebrow">Maintenance operations</div><h1>Work orders unavailable</h1><p>Check the server environment and database connection.</p></section>;
  }
  const canOperate = roleAllowed((await currentSession())?.role);
  return <><header className="page-heading route-heading"><div><div className="eyebrow">Maintenance operations / control board</div><h1>Work Orders</h1><p className="muted">Coordinate scheduled, corrective, and preventive maintenance activity.</p></div><div className="heading-stamp"><span className="status-dot" aria-hidden="true" /> {orders.length} records loaded</div></header><section className={`work-order-layout ${canOperate ? "" : "single-column"}`}><div className="reference-panel table-card"><div className="reference-panel-title"><span className="panel-icon">⚒</span><h2>Operations queue</h2><span className="heading-stamp">MySQL · cache max 30s</span></div><div className="table-wrap"><WorkOrderManager orders={orders} canOperate={canOperate} /></div></div>{canOperate && <div className="reference-panel form-card"><div className="reference-panel-title"><span className="panel-icon">＋</span><h2>New tasking</h2></div><p className="muted">Assign a maintenance action to an existing asset.</p><NewWorkOrderForm assets={assets} /></div>}</section></>;
}
