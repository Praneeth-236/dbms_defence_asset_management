import { logDatabaseError, query } from "../../lib/db";
import type { RowDataPacket } from "mysql2/promise";
import DependencyManager from "./dependency-manager";
import { currentSession, hasRole } from "../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

type Dependency = RowDataPacket & { ComponentID: number; DependsOnComponentID: number; ComponentName: string; DependsOn: string; SubsystemName: string; AssetName: string };
type SpareLink = RowDataPacket & { ComponentName: string; PartName: string; QuantityRequired: number | null; IsCritical: string | null };

export default async function DependenciesPage() {
  let dependencies: Dependency[] = [];
  let components: ({ ComponentID: number; ComponentName: string } & RowDataPacket)[] = [];
  let spares: SpareLink[] = [];
  try {
    [dependencies, spares, components] = await Promise.all([
      cached("dependencies:list", () => query<Dependency[]>("SELECT cd.ComponentID, cd.DependsOnComponentID, c1.ComponentName, c2.ComponentName AS DependsOn, ss.SubsystemName, a.AssetName FROM component_dependency cd JOIN component c1 ON c1.ComponentID = cd.ComponentID JOIN component c2 ON c2.ComponentID = cd.DependsOnComponentID JOIN subsystem ss ON ss.SubsystemID = c1.SubsystemID JOIN asset a ON a.AssetID = ss.AssetID ORDER BY a.AssetName, c1.ComponentName"), CACHE_TTL_SECONDS.operational, ["dependencies", "hierarchy", "assets"]),
      cached("dependencies:spare-links", () => query<SpareLink[]>("SELECT c.ComponentName, sp.PartName, cs.QuantityRequired, cs.IsCritical FROM component c JOIN component_spare cs ON cs.ComponentID = c.ComponentID JOIN spare_part sp ON sp.SparePartID = cs.SparePartID ORDER BY c.ComponentName"), CACHE_TTL_SECONDS.operational, ["hierarchy", "inventory"]),
      cached("dependencies:component-options", () => query<({ ComponentID: number; ComponentName: string } & RowDataPacket)[]>("SELECT ComponentID, ComponentName FROM COMPONENT ORDER BY ComponentName"), CACHE_TTL_SECONDS.operational, ["hierarchy"])
    ]);
  } catch (error) {
    logDatabaseError("dependencies", error);
    return <section className="error"><div className="eyebrow">Dependency analysis</div><h1>Dependencies unavailable</h1><p>Check the server environment and database connection.</p></section>;
  }
  const canManage = hasRole(await currentSession(), ["Admin"]);
  return <><header className="page-heading route-heading"><div><div className="eyebrow">Systems analysis / dependency graph</div><h1>Dependencies</h1><p className="muted">Trace subsystem relationships and the spare parts required to keep assets ready.</p></div><div className="heading-stamp"><span className="status-dot" aria-hidden="true" /> {dependencies.length} relationships</div></header><section className="reference-panel dependency-board"><div className="reference-panel-title"><span className="panel-icon">⌘</span><h2>{canManage ? "Manage component dependencies" : "Component dependencies"}</h2><span className="heading-stamp">{canManage ? "Admin control" : "Read only"}</span></div><DependencyManager initialDependencies={dependencies} components={components} canManage={canManage} /></section><section className="reference-panel detail-table-card"><div className="reference-panel-title"><span className="panel-icon">▣</span><h2>Required spare parts</h2><span className="heading-stamp">{spares.length} mappings</span></div><div className="table-wrap"><table><thead><tr><th>Component</th><th>Part</th><th>Qty</th></tr></thead><tbody>{spares.map((row, i) => <tr key={`${row.ComponentName}-${row.PartName}-${i}`}><td>{row.ComponentName}</td><td>{row.PartName}</td><td>{row.QuantityRequired ?? "—"}</td></tr>)}</tbody></table>{spares.length === 0 && <div className="empty">No component-spare mappings found.</div>}</div></section></>;
}
