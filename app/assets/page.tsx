import { query } from "../../lib/db";
import type { AssetSummary } from "../../lib/types";
import type { RowDataPacket } from "mysql2/promise";
import AssetManager from "./asset-manager";
import { currentSession, hasRole } from "../../lib/auth";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const search = (await searchParams).q?.trim().slice(0, 100) ?? "";
  let assets: (AssetSummary & RowDataPacket)[] = [];
  let units: ({ UnitID: number; UnitName: string } & RowDataPacket)[] = [];
  let assetTypes: ({ AssetTypeID: number; AssetTypeName: string } & RowDataPacket)[] = [];
  try {
    [assets, units, assetTypes] = await Promise.all([
      cached(`assets:list:${search}`, () => query<(AssetSummary & RowDataPacket)[]>("SELECT a.AssetID, a.AssetName, a.IdentificationNo, a.Model, a.MnfYear, a.Status, a.CriticalityLevel, u.UnitName, s.ServiceName FROM ASSET a JOIN UNIT u ON u.UnitID = a.UnitID JOIN SERVICE s ON s.ServiceID = u.ServiceID WHERE (? = '' OR a.AssetName LIKE ? OR a.IdentificationNo LIKE ? OR a.Model LIKE ?) ORDER BY a.AssetID LIMIT 200", [search, `%${search}%`, `%${search}%`, `%${search}%`]), CACHE_TTL_SECONDS.operational, ["assets"]),
      cached("assets:unit-options", () => query<({ UnitID: number; UnitName: string } & RowDataPacket)[]>("SELECT UnitID, UnitName FROM UNIT ORDER BY UnitName"), CACHE_TTL_SECONDS.reference, ["asset-options"]),
      cached("assets:type-options", () => query<({ AssetTypeID: number; AssetTypeName: string } & RowDataPacket)[]>("SELECT AssetTypeID, AssetTypeName FROM ASSET_TYPE ORDER BY AssetTypeName"), CACHE_TTL_SECONDS.reference, ["asset-options"])
    ]);
  } catch {
    return <section className="error"><div className="eyebrow">Fleet registry</div><h1>Assets unavailable</h1><p>Check the server environment and database connection.</p></section>;
  }
  return <><header className="page-heading route-heading"><div><div className="eyebrow">Fleet registry / asset control</div><h1>Asset Registry</h1><p className="muted">Search, assess, and maintain the authoritative fleet register.</p></div><div className="heading-stamp"><span className="status-dot" aria-hidden="true" /> {assets.length} records loaded</div></header><section className="reference-panel route-panel"><div className="reference-panel-title"><span className="panel-icon">▰</span><h2>Fleet assets</h2><span className="heading-stamp">MySQL source</span></div><AssetManager initialAssets={assets} initialSearch={search} units={units} assetTypes={assetTypes} canManage={hasRole(await currentSession(), ["Admin"])} /></section></>;
}
