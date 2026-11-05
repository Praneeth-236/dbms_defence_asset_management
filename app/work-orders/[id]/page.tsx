import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "../../../lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { formatDate, formatDateTime } from "../../../lib/date-format";
import { currentSession, roleAllowed } from "../../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../../lib/cache";
import MaintenanceEventForm from "./maintenance-event-form";

export const dynamic = "force-dynamic";

type Detail = RowDataPacket & {
  WorkOrderID: number;
  AssetID: number;
  AssetName: string;
  Description: string | null;
  OrderDate: string | Date | null;
  Priority: string | null;
  Status: string | null;
};
type MaintenanceEvent = RowDataPacket & {
  MaintenanceID: number;
  MaintenanceType: string | null;
  ActionTaken: string | null;
  Remarks: string | null;
  StartDateTime: string | Date | null;
  EndDateTime: string | Date | null;
  DowntimeHours: string | null;
  CostIncurred: string | null;
};

export default async function WorkOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const rows = await cached(`work-orders:detail:${id}`, () => query<Detail[]>(
    "SELECT wo.WorkOrderID, wo.AssetID, a.AssetName, wo.Description, wo.OrderDate, wo.Priority, wo.Status FROM MAINTENANCE_WORK_ORDER wo JOIN ASSET a ON a.AssetID = wo.AssetID WHERE wo.WorkOrderID = ?",
    [id]
  ), CACHE_TTL_SECONDS.operational, ["work-orders", "assets"]);
  const order = rows[0];
  if (!order) notFound();
  const events = await cached(`maintenance-events:work-order:${id}`, () => query<MaintenanceEvent[]>(
    "SELECT MaintenanceID, MaintenanceType, ActionTaken, Remarks, StartDateTime, EndDateTime, DowntimeHours, CostIncurred FROM MAINTENANCE_EVENT WHERE WorkOrderID = ? ORDER BY COALESCE(StartDateTime, EndDateTime) DESC, MaintenanceID DESC",
    [id]
  ), CACHE_TTL_SECONDS.operational, ["maintenance-events", "work-orders"]);
  const canOperate = roleAllowed((await currentSession())?.role);

  return <>
    <header className="page-heading route-heading">
      <div><div className="eyebrow">Maintenance dossier / work order</div><h1>WO-{order.WorkOrderID}</h1><p className="muted"><Link href={`/assets/${order.AssetID}`}>{order.AssetName}</Link> · Component association is not stored for work orders in the current schema.</p></div>
      <Link className="button" href="/work-orders">← Back to work orders</Link>
    </header>
    <section className="detail-grid">
      <div className="reference-panel dossier-card"><div className="reference-panel-title"><span className="panel-icon">⚒</span><h2>Task posture</h2></div><div className="dossier-status"><span className="dossier-symbol">WO</span><span className="pill">{order.Status ?? "Unspecified"}</span></div><dl className="detail-list"><div><dt>Priority</dt><dd>{order.Priority ?? "Unspecified"}</dd></div><div><dt>Order date</dt><dd>{formatDate(order.OrderDate)}</dd></div></dl></div>
      <div className="reference-panel detail-copy"><div className="reference-panel-title"><span className="panel-icon">▤</span><h2>Maintenance brief</h2></div><h2>{order.AssetName}</h2><p>{order.Description ?? "No description recorded."}</p></div>
    </section>
    <section className="reference-panel dossier-card">
      <div className="reference-panel-title"><h2>Recorded maintenance events</h2></div>
      {events.length ? <div className="table-wrap"><table><thead><tr><th>Type</th><th>Started</th><th>Ended</th><th>Downtime (hours)</th><th>Action</th><th>Remarks</th><th>Cost recorded</th></tr></thead><tbody>{events.map((event) => <tr key={event.MaintenanceID}><td>{event.MaintenanceType ?? "Unspecified"}</td><td>{formatDateTime(event.StartDateTime, "Not recorded")}</td><td>{formatDateTime(event.EndDateTime, "Not recorded")}</td><td>{event.DowntimeHours ?? "Not recorded"}</td><td>{event.ActionTaken ?? "Unspecified"}</td><td>{event.Remarks ?? "Unspecified"}</td><td>{event.CostIncurred ?? "No cost recorded"}</td></tr>)}</tbody></table></div> : <p className="muted">No maintenance events have been recorded.</p>}
    </section>
    {canOperate && <section id="record-maintenance-event" className="reference-panel form-card"><div className="reference-panel-title"><h2>Record maintenance event</h2></div><MaintenanceEventForm workOrderId={order.WorkOrderID} /></section>}
  </>;
}
