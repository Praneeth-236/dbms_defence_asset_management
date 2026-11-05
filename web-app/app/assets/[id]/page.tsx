import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "../../../lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { formatDateTime } from "../../../lib/date-format";
import { displayMaintenanceCost } from "../../../lib/inventory-values.mjs";
import { currentSession, hasRole, roleAllowed } from "../../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../../lib/cache";
import AssetHierarchyManager from "./asset-hierarchy-manager";

export const dynamic = "force-dynamic";

type Detail = RowDataPacket & {
  AssetID: number;
  AssetName: string;
  IdentificationNo: string | null;
  MnfYear: number | null;
  Status: string | null;
  CriticalityLevel: string | null;
  Model: string | null;
  UnitName: string;
  ServiceName: string;
};
type Failure = RowDataPacket & { FailureID: number; FailureType: string | null; Severity: string | null; OccurredAt: string | Date | null };
type WorkOrder = RowDataPacket & { WorkOrderID: number; Description: string | null; Status: string | null; Priority: string | null };
type Subsystem = RowDataPacket & { SubsystemID: number; SubsystemName: string; Description: string | null; CriticalityLevel: string | null };
type Component = RowDataPacket & { ComponentID: number; SubsystemID: number; ComponentName: string; Description: string | null; CriticalityLevel: string | null; IsRepairable: string | null };
type MaintenanceEvent = RowDataPacket & {
  MaintenanceID: number;
  WorkOrderID: number;
  MaintenanceType: string | null;
  ActionTaken: string | null;
  Remarks: string | null;
  StartDateTime: string | Date | null;
  EndDateTime: string | Date | null;
  DowntimeHours: string | null;
  CostIncurred: string | null;
};

export default async function AssetDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const details = await cached(`assets:detail:${id}`,
    () => query<Detail[]>(
    "SELECT a.AssetID, a.AssetName, a.IdentificationNo, a.MnfYear, a.Status, a.CriticalityLevel, a.Model, u.UnitName, s.ServiceName FROM ASSET a JOIN UNIT u ON u.UnitID = a.UnitID JOIN SERVICE s ON s.ServiceID = u.ServiceID WHERE a.AssetID = ?",
    [id]
    ), CACHE_TTL_SECONDS.operational, ["assets"]);
  if (!details[0]) notFound();
  const [failures, orders, subsystems, components, maintenanceEvents] = await Promise.all([
    cached(`assets:failures:${id}`, () => query<Failure[]>("SELECT FailureID, FailureType, Severity, OccurredAt FROM FAILURE_EVENT WHERE AssetID = ? ORDER BY OccurredAt DESC LIMIT 100", [id]), CACHE_TTL_SECONDS.operational, ["assets", "failures"]),
    cached(`assets:work-orders:${id}`, () => query<WorkOrder[]>("SELECT WorkOrderID, Description, Status, Priority FROM MAINTENANCE_WORK_ORDER WHERE AssetID = ? ORDER BY OrderDate DESC LIMIT 100", [id]), CACHE_TTL_SECONDS.operational, ["assets", "work-orders"]),
    cached(`assets:subsystems:${id}`, () => query<Subsystem[]>("SELECT SubsystemID, SubsystemName, Description, CriticalityLevel FROM SUBSYSTEM WHERE AssetID = ? ORDER BY SubsystemName, SubsystemID", [id]), CACHE_TTL_SECONDS.operational, ["assets", "hierarchy"]),
    cached(`assets:components:${id}`, () => query<Component[]>("SELECT c.ComponentID, c.SubsystemID, c.ComponentName, c.Description, c.CriticalityLevel, c.IsRepairable FROM COMPONENT c JOIN SUBSYSTEM ss ON ss.SubsystemID = c.SubsystemID WHERE ss.AssetID = ? ORDER BY ss.SubsystemName, c.ComponentName, c.ComponentID", [id]), CACHE_TTL_SECONDS.operational, ["assets", "hierarchy"]),
    cached(`assets:maintenance-events:${id}`, () => query<MaintenanceEvent[]>("SELECT me.MaintenanceID, me.WorkOrderID, me.MaintenanceType, me.ActionTaken, me.Remarks, me.StartDateTime, me.EndDateTime, me.DowntimeHours, me.CostIncurred FROM MAINTENANCE_EVENT me JOIN MAINTENANCE_WORK_ORDER wo ON wo.WorkOrderID = me.WorkOrderID WHERE wo.AssetID = ? ORDER BY COALESCE(me.StartDateTime, me.EndDateTime) DESC, me.MaintenanceID DESC LIMIT 200", [id]), CACHE_TTL_SECONDS.operational, ["assets", "work-orders", "maintenance-events"])
  ]);
  let idGenerationReady = false;
  try {
    const idColumns = await cached("assets:hierarchy-id-generation", () => query<(RowDataPacket & { TABLE_NAME: string; EXTRA: string })[]>(
      "SELECT UPPER(TABLE_NAME) AS TABLE_NAME, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((UPPER(TABLE_NAME) = 'SUBSYSTEM' AND UPPER(COLUMN_NAME) = 'SUBSYSTEMID') OR (UPPER(TABLE_NAME) = 'COMPONENT' AND UPPER(COLUMN_NAME) = 'COMPONENTID'))"
    ), CACHE_TTL_SECONDS.reference, ["hierarchy"]);
    idGenerationReady = idColumns.length === 2 && idColumns.every((column) => column.EXTRA.split(/\s+/).includes("auto_increment"));
  } catch {
    // Keep the read-only hierarchy visible if metadata permissions are limited.
  }
  const asset = details[0];
  const session = await currentSession();
  const canManageHierarchy = hasRole(session, ["Admin"]);
  const canRecordMaintenance = roleAllowed(session?.role);
  return <>
    <header className="page-heading route-heading">
      <div><div className="eyebrow">Fleet dossier / asset detail</div><h1>{asset.AssetName}</h1><p className="muted">{asset.UnitName} · {asset.ServiceName} · {asset.Model ?? "Model unspecified"}</p></div>
      <Link className="button" href="/assets">← Back to assets</Link>
    </header>
    <section className="detail-grid">
      <div className="reference-panel dossier-card">
        <div className="reference-panel-title"><span className="panel-icon">▰</span><h2>Recorded asset status</h2></div>
        <div className="dossier-status"><span className="dossier-symbol">DA</span><span className={`pill ${asset.Status === "Ready" ? "ready" : "warning"}`}>{asset.Status ?? "Unspecified"}</span></div>
        <dl className="detail-list">
          <div><dt>Identification no.</dt><dd>{asset.IdentificationNo ?? "Unspecified"}</dd></div>
          <div><dt>Manufacture year</dt><dd>{asset.MnfYear ?? "Unspecified"}</dd></div>
          <div><dt>Criticality</dt><dd>{asset.CriticalityLevel ?? "Unspecified"}</dd></div>
          <div><dt>Unit</dt><dd>{asset.UnitName}</dd></div>
          <div><dt>Service</dt><dd>{asset.ServiceName}</dd></div>
        </dl>
      </div>
      <div className="reference-panel">
        <div className="reference-panel-title"><span className="panel-icon">!</span><h2>Recorded failures</h2></div>
        {failures.length ? <ul className="event-list">{failures.map((failure) => <li key={failure.FailureID}><span className="event-mark">!</span><span><strong>{failure.FailureType ?? "Failure"}</strong><small>{failure.Severity ?? "Unspecified"} · {formatDateTime(failure.OccurredAt)}</small></span></li>)}</ul> : <div className="empty">No failures recorded.</div>}
      </div>
    </section>
    <section className="reference-panel detail-table-card">
      <div className="reference-panel-title"><span className="panel-icon">⌘</span><h2>Components</h2></div>
      <AssetHierarchyManager assetId={asset.AssetID} subsystems={subsystems} components={components} canManage={canManageHierarchy} idGenerationReady={idGenerationReady} />
    </section>
    <section className="reference-panel detail-table-card">
      <div className="reference-panel-title"><span className="panel-icon">⚒</span><h2>Work orders</h2><span className="heading-stamp">{orders.length} linked</span></div>
      <div className="table-wrap"><table><thead><tr><th>ID</th><th>Description</th><th>Priority</th><th>Status</th><th>Maintenance</th></tr></thead><tbody>{orders.map((order) => <tr key={order.WorkOrderID}><td><Link href={`/work-orders/${order.WorkOrderID}`}>WO-{order.WorkOrderID}</Link></td><td>{order.Description ?? "Unspecified"}</td><td>{order.Priority ?? "Unspecified"}</td><td><span className="pill">{order.Status ?? "Unspecified"}</span></td><td><Link className="button" href={`/work-orders/${order.WorkOrderID}#record-maintenance-event`}>{canRecordMaintenance ? "Record event" : "View events"}</Link></td></tr>)}</tbody></table>{orders.length === 0 && <div className="empty">No work orders recorded.</div>}</div>
    </section>
    <section className="reference-panel detail-table-card">
      <h2>Maintenance history</h2>
      {maintenanceEvents.length ? <div className="table-wrap"><table><thead><tr><th>Work order</th><th>Type</th><th>Started</th><th>Ended</th><th>Downtime (hours)</th><th>Action</th><th>Cost</th></tr></thead><tbody>{maintenanceEvents.map((event) => <tr key={event.MaintenanceID}>
        <td><Link href={`/work-orders/${event.WorkOrderID}`}>WO-{event.WorkOrderID}</Link></td>
        <td>{event.MaintenanceType ?? "Unspecified"}</td>
        <td>{formatDateTime(event.StartDateTime, "Not recorded")}</td>
        <td>{formatDateTime(event.EndDateTime, "Not recorded")}</td>
        <td>{event.DowntimeHours ?? "Not recorded"}</td>
        <td>{event.ActionTaken ?? event.Remarks ?? "Not recorded"}</td>
        <td>{displayMaintenanceCost(event.CostIncurred)}</td>
      </tr>)}</tbody></table></div> : <div className="empty">No maintenance events recorded for this asset.</div>}
    </section>
  </>;
}
