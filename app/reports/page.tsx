import { query } from "../../lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { displayMaintenanceCost } from "../../lib/inventory-values.mjs";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

type Cost = RowDataPacket & { MaintenanceType: string | null; TotalCost: number | null; EventCount: number };
type Failure = RowDataPacket & { AssetName: string; FailureCount: number };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  let costs: Cost[] = [];
  let failures: Failure[] = [];
  const type = (await searchParams).type?.trim() ?? "";
  try {
    [costs, failures] = await Promise.all([
      cached(`reports:maintenance-cost:${type}`, () => query<Cost[]>("SELECT MaintenanceType, COUNT(*) AS EventCount, SUM(CostIncurred) AS TotalCost FROM MAINTENANCE_EVENT WHERE (? = '' OR MaintenanceType = ?) GROUP BY MaintenanceType ORDER BY TotalCost DESC", [type, type]), CACHE_TTL_SECONDS.reports, ["maintenance-events"]),
      cached("reports:failures-by-asset", () => query<Failure[]>("SELECT a.AssetName, COUNT(f.FailureID) AS FailureCount FROM ASSET a JOIN FAILURE_EVENT f ON f.AssetID = a.AssetID GROUP BY a.AssetID, a.AssetName ORDER BY FailureCount DESC, a.AssetName"), CACHE_TTL_SECONDS.reports, ["failures", "assets"])
    ]);
  } catch {
    return <section className="error"><div className="eyebrow">SQL-backed reporting</div><h1>Reports unavailable</h1><p>Check the server environment and database connection.</p></section>;
  }
  return <><header className="page-heading route-heading"><div><div className="eyebrow">SQL-backed reporting / decision support</div><h1>Reports</h1><p className="muted">Use relational aggregates to identify maintenance cost and failure concentration.</p></div><div className="heading-stamp"><span className="status-dot" aria-hidden="true" /> Cached query · max 60s</div></header><section className="reference-panel filter-card"><div className="reference-panel-title"><span className="panel-icon">⌁</span><h2>Report filter</h2></div><form className="form form-inline" method="get"><label htmlFor="maintenance-type">Maintenance type<input id="maintenance-type" name="type" defaultValue={type} placeholder="Repair, Inspection..." /></label><button className="button" type="submit">Run report</button></form></section><section className="grid two report-grid"><div className="reference-panel detail-table-card"><div className="reference-panel-title"><span className="panel-icon">▤</span><h2>Cost by maintenance type</h2><span className="heading-stamp">{costs.length} types</span></div><div className="table-wrap"><table><thead><tr><th>Type</th><th>Events</th><th>Total cost</th></tr></thead><tbody>{costs.map((row) => <tr key={row.MaintenanceType ?? "unknown"}><td>{row.MaintenanceType ?? "Unspecified"}</td><td>{row.EventCount}</td><td>{displayMaintenanceCost(row.TotalCost)}</td></tr>)}</tbody></table>{costs.length === 0 && <div className="empty">No maintenance events found.</div>}</div></div><div className="reference-panel detail-table-card"><div className="reference-panel-title"><span className="panel-icon">!</span><h2>Failure frequency</h2><span className="heading-stamp">{failures.length} assets</span></div><div className="table-wrap"><table><thead><tr><th>Asset</th><th>Failures</th></tr></thead><tbody>{failures.map((row) => <tr key={row.AssetName}><td>{row.AssetName}</td><td>{row.FailureCount}</td></tr>)}</tbody></table>{failures.length === 0 && <div className="empty">No failures found.</div>}</div></div></section></>;
}
