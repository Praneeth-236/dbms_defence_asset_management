import Link from "next/link";
import { query } from "../lib/db";
import { cached, CACHE_TTL_SECONDS, DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TAGS, dashboardCacheDiagnostic, deleteCache } from "../lib/cache";
import { formatDate, formatDateTime } from "../lib/date-format";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

type AssetStatus = RowDataPacket & { Status: string | null; count: number };
type WorkOrderStatus = RowDataPacket & { Status: string | null; count: number };
type FailureEvent = RowDataPacket & {
  FailureID: number;
  AssetID: number;
  AssetName: string;
  FailureType: string | null;
  Severity: string | null;
  OccurredAt: string | Date | null;
};
type MaintenanceActivity = RowDataPacket & {
  MaintenanceID: number;
  WorkOrderID: number;
  AssetID: number;
  AssetName: string;
  MaintenanceType: string | null;
  ActionTaken: string | null;
  StartDateTime: string | Date | null;
};
type AttentionAsset = RowDataPacket & {
  AssetID: number;
  AssetName: string;
  Status: string | null;
  CriticalityLevel: string | null;
  UnitName: string;
};
type DashboardData = {
  version: number;
  totalAssets: number;
  assetStatuses: AssetStatus[];
  workOrderStatuses: WorkOrderStatus[];
  recentFailures: FailureEvent[];
  recentMaintenance: MaintenanceActivity[];
  attentionAssets: AttentionAsset[];
};

async function dashboardData(): Promise<DashboardData> {
  const data = await cached<DashboardData & { version?: number }>(DASHBOARD_CACHE_KEY, async () => {
    const [total, assetStatuses, workOrderStatuses, recentFailures, recentMaintenance, attentionAssets] = await Promise.all([
      query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM ASSET"),
      query<AssetStatus[]>("SELECT Status, COUNT(*) AS count FROM ASSET GROUP BY Status ORDER BY count DESC, Status"),
      query<WorkOrderStatus[]>("SELECT Status, COUNT(*) AS count FROM MAINTENANCE_WORK_ORDER GROUP BY Status ORDER BY count DESC, Status"),
      query<FailureEvent[]>("SELECT f.FailureID, f.AssetID, a.AssetName, f.FailureType, f.Severity, f.OccurredAt FROM FAILURE_EVENT f JOIN ASSET a ON a.AssetID = f.AssetID ORDER BY f.OccurredAt DESC, f.FailureID DESC LIMIT 4"),
      query<MaintenanceActivity[]>("SELECT me.MaintenanceID, wo.WorkOrderID, a.AssetID, a.AssetName, me.MaintenanceType, me.ActionTaken, me.StartDateTime FROM MAINTENANCE_EVENT me JOIN MAINTENANCE_WORK_ORDER wo ON wo.WorkOrderID = me.WorkOrderID JOIN ASSET a ON a.AssetID = wo.AssetID ORDER BY COALESCE(me.StartDateTime, me.EndDateTime) DESC, me.MaintenanceID DESC LIMIT 4"),
      query<AttentionAsset[]>("SELECT a.AssetID, a.AssetName, a.Status, a.CriticalityLevel, u.UnitName FROM ASSET a JOIN UNIT u ON u.UnitID = a.UnitID WHERE a.Status IN ('Unavailable', 'Degraded') ORDER BY a.Status, a.AssetName LIMIT 6")
    ]);
    return {
      version: 2,
      totalAssets: Number(total[0]?.total ?? 0),
      assetStatuses,
      workOrderStatuses,
      recentFailures,
      recentMaintenance,
      attentionAssets
    };
  }, CACHE_TTL_SECONDS.dashboard, DASHBOARD_CACHE_TAGS);

  // Discard the prior dashboard payload shape after a deployment changes its panels.
  if (data.version !== 2) {
    await deleteCache(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TAGS);
    return dashboardData();
  }
  return data;
}

async function logLocalCacheDiagnostic(): Promise<void> {
  if (process.env.NODE_ENV === "production" || process.env.DARMS_LOCAL_REDIS_DIAGNOSTIC !== "1") return;
  const diagnostic = await dashboardCacheDiagnostic();
  console.info("[redis.dashboard-diagnostic]", diagnostic);
}

function recordedCount(statuses: AssetStatus[], status: string): number {
  return statuses.find((row) => row.Status === status)?.count ?? 0;
}

function activeWorkOrderCount(statuses: WorkOrderStatus[]): number {
  return statuses.reduce((total, row) => total + (row.Status === "Open" || row.Status === "InProgress" ? Number(row.count) : 0), 0);
}

function statusTone(status: string | null): string {
  if (status === "Ready") return "status-ready";
  if (status === "Unavailable") return "status-unavailable";
  if (status === "Degraded" || status === "Under Maintenance") return "status-warning";
  return "status-neutral";
}

function severityTone(severity: string | null): string {
  if (severity === "High" || severity === "Critical") return "severity-high";
  if (severity === "Medium") return "severity-medium";
  return "severity-neutral";
}

function donutGradient(statuses: AssetStatus[], total: number): string {
  if (!total) return "conic-gradient(#24374a 0deg 360deg)";
  const colors = ["#37d488", "#38a8ff", "#ffad32", "#ff5a63", "#9c83ff", "#72859b"];
  let cursor = 0;
  const stops = statuses.map((row, index) => {
    const start = cursor;
    cursor += (row.count / total) * 360;
    return `${colors[index % colors.length]} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export default async function Dashboard() {
  let data: DashboardData;
  try {
    data = await dashboardData();
    await logLocalCacheDiagnostic();
  } catch {
    return <section className="dashboard-error" role="alert"><span className="eyebrow">Operations data</span><h2>Dashboard unavailable</h2><p>MySQL could not provide the dashboard records. Check the database connection and retry.</p><Link className="button" href="/">Retry dashboard</Link></section>;
  }

  const statusTotal = data.assetStatuses.reduce((sum, row) => sum + Number(row.count), 0);
  const maxWorkOrders = Math.max(1, ...data.workOrderStatuses.map((row) => Number(row.count)));
  const gradient = donutGradient(data.assetStatuses, statusTotal);

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero-reference" aria-labelledby="dashboard-heading">
        <div className="hero-copy">
          <div className="hero-kicker">Defence operations</div>
          <h2 id="dashboard-heading">Asset Readiness Overview</h2>
          <p>Recorded asset status, maintenance work orders, and failure events.</p>
        </div>
        <div className="hero-art-reference" aria-hidden="true">
          <svg viewBox="0 0 760 190" role="presentation">
            <defs><linearGradient id="flight-line" x1="0" x2="1"><stop stopColor="#22c7ee" stopOpacity="0" /><stop offset=".48" stopColor="#22c7ee" stopOpacity=".8" /><stop offset="1" stopColor="#22c7ee" stopOpacity="0" /></linearGradient></defs>
            <path className="hero-radar" d="M350 0v190M255 95h190M283 28l134 134m0-134L283 162" />
            <circle className="hero-radar" cx="350" cy="95" r="72" /><circle className="hero-radar" cx="350" cy="95" r="48" /><circle className="hero-radar" cx="350" cy="95" r="23" />
            <path className="hero-flight-line" d="M0 110h760" />
            <path className="hero-jet" d="m412 94 78-14 66-42 12 4-35 47 118 18-7 12-125-8-57 54-13-4 21-52-59-6-27 18-10-3 10-24-12-12Z" />
          </svg>
        </div>
        <span className="hero-data-note">Live records · MySQL</span>
      </section>

      <section className="reference-metrics" aria-label="Asset and work-order totals">
        <article className="reference-metric metric-total"><span className="metric-symbol" aria-hidden="true">✈</span><div><span>Total assets</span><strong>{data.totalAssets}</strong></div></article>
        <article className="reference-metric metric-ready"><span className="metric-symbol" aria-hidden="true">✓</span><div><span>Ready · recorded status</span><strong>{recordedCount(data.assetStatuses, "Ready")}</strong></div></article>
        <article className="reference-metric metric-maint"><span className="metric-symbol" aria-hidden="true">⚒</span><div><span>Active work orders</span><strong>{activeWorkOrderCount(data.workOrderStatuses)}</strong></div></article>
        <article className="reference-metric metric-offline"><span className="metric-symbol" aria-hidden="true">!</span><div><span>Unavailable · recorded status</span><strong>{recordedCount(data.assetStatuses, "Unavailable")}</strong></div></article>
      </section>

      <section className="reference-grid reference-grid-top" aria-label="Operational summaries">
        <article className="reference-panel status-panel">
          <div className="reference-panel-title"><span className="panel-icon panel-blue" aria-hidden="true">◒</span><h2>Asset Status Distribution</h2><span className="panel-caption">Recorded status</span></div>
          {data.assetStatuses.length ? <div className="status-distribution">
            <div className="recorded-donut" role="img" aria-label={`Recorded statuses for ${statusTotal} assets`} style={{ background: gradient }}><div><strong>{statusTotal}</strong><span>Assets</span></div></div>
            <ul className="status-legend">{data.assetStatuses.map((row, index) => <li key={row.Status ?? "null-status"}><span className="legend-swatch" style={{ backgroundColor: ["#37d488", "#38a8ff", "#ffad32", "#ff5a63", "#9c83ff", "#72859b"][index % 6] }} /><span>{row.Status ?? "Unspecified"}</span><strong>{row.count}</strong></li>)}</ul>
          </div> : <div className="panel-empty"><strong>No asset records</strong><span>Asset statuses will appear here when stored in MySQL.</span></div>}
        </article>

        <article className="reference-panel work-order-panel">
          <div className="reference-panel-title"><span className="panel-icon panel-blue" aria-hidden="true">▤</span><h2>Maintenance Work Orders</h2><Link href="/work-orders">View all <span aria-hidden="true">→</span></Link></div>
          {data.workOrderStatuses.length ? <ul className="work-order-status-list">{data.workOrderStatuses.map((row) => <li key={row.Status ?? "null-status"}><span>{row.Status ?? "Unspecified"}</span><span className="work-status-track"><i style={{ width: `${Math.max((Number(row.count) / maxWorkOrders) * 100, 4)}%` }} /></span><strong>{row.count}</strong></li>)}</ul> : <div className="panel-empty"><strong>No work orders</strong><span>Work order statuses will appear here when recorded.</span></div>}
        </article>

        <article className="reference-panel alerts-panel">
          <div className="reference-panel-title"><span className="panel-icon panel-red" aria-hidden="true">△</span><h2>Recent Alerts</h2><Link href="/failures">Failure events <span aria-hidden="true">→</span></Link></div>
          <p className="panel-subtitle">Stored failure events</p>
          {data.recentFailures.length ? <ul className="recent-alert-list">{data.recentFailures.map((failure) => <li key={failure.FailureID}>
            <span className={`alert-severity ${severityTone(failure.Severity)}`} aria-hidden="true">!</span>
            <span className="alert-record"><strong>{failure.AssetName}</strong><span>{failure.FailureType ?? "Failure event"}</span><small>{failure.Severity ?? "Severity unspecified"} · {formatDateTime(failure.OccurredAt)}</small></span>
          </li>)}</ul> : <div className="panel-empty"><strong>No failure events</strong><span>There are no recorded failure events to show.</span></div>}
        </article>
      </section>

      <section className="reference-grid reference-grid-bottom" aria-label="Recent records and attention list">
        <article className="reference-panel maintenance-activity-panel">
          <div className="reference-panel-title"><span className="panel-icon panel-blue" aria-hidden="true">⚒</span><h2>Recent Maintenance Activity</h2><Link href="/work-orders">Work orders <span aria-hidden="true">→</span></Link></div>
          {data.recentMaintenance.length ? <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Work order</th><th>Asset</th><th>Type / action</th><th>Started</th></tr></thead><tbody>{data.recentMaintenance.map((event) => <tr key={event.MaintenanceID}>
            <td><Link href={`/work-orders/${event.WorkOrderID}`}>WO-{event.WorkOrderID}</Link></td>
            <td><Link href={`/assets/${event.AssetID}`}>{event.AssetName}</Link></td>
            <td><span>{event.MaintenanceType ?? "Type unspecified"}</span><small>{event.ActionTaken ?? "Action not recorded"}</small></td>
            <td>{formatDate(event.StartDateTime)}</td>
          </tr>)}</tbody></table></div> : <div className="panel-empty"><strong>No maintenance activity</strong><span>Maintenance events will appear here when recorded.</span></div>}
        </article>

        <article className="reference-panel attention-panel">
          <div className="reference-panel-title"><span className="panel-icon panel-amber" aria-hidden="true">△</span><h2>Assets Requiring Attention</h2><Link href="/assets">View assets <span aria-hidden="true">→</span></Link></div>
          <p className="panel-subtitle">Assets with stored status Degraded or Unavailable</p>
          {data.attentionAssets.length ? <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Asset</th><th>Recorded status</th><th>Criticality</th><th>Unit</th></tr></thead><tbody>{data.attentionAssets.map((asset) => <tr key={asset.AssetID}>
            <td><Link href={`/assets/${asset.AssetID}`}>{asset.AssetName}</Link></td>
            <td><span className={`recorded-status ${statusTone(asset.Status)}`}>{asset.Status ?? "Unspecified"}</span></td>
            <td>{asset.CriticalityLevel ?? "Unspecified"}</td>
            <td>{asset.UnitName}</td>
          </tr>)}</tbody></table></div> : <div className="panel-empty"><strong>No matching stored statuses</strong><span>No assets currently have a stored status of Degraded or Unavailable.</span></div>}
        </article>
      </section>
      <p className="dashboard-footnote">MySQL remains the source of truth. Redis caches server reads briefly and invalidates affected data after successful mutations.</p>
    </div>
  );
}
