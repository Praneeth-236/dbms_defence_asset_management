import Link from "next/link";
import { query } from "../../lib/db";
import { formatDateTime } from "../../lib/date-format";
import type { RowDataPacket } from "mysql2/promise";
import { currentSession, roleAllowed } from "../../lib/auth";
import FailureForm from "./failure-form";
import { cached, CACHE_TTL_SECONDS } from "../../lib/cache";

export const dynamic = "force-dynamic";

type Failure = RowDataPacket & {
  FailureID: number;
  AssetID: number;
  AssetName: string;
  FailureType: string | null;
  Severity: string | null;
  OccurredAt: string | Date | null;
  Description: string | null;
};
type AssetOption = RowDataPacket & { AssetID: number; AssetName: string };

export default async function FailuresPage() {
  let failures: Failure[];
  let assets: AssetOption[];
  try {
    [failures, assets] = await Promise.all([
      cached("failures:list", () => query<Failure[]>(
        "SELECT f.FailureID, f.AssetID, a.AssetName, f.FailureType, f.Severity, f.OccurredAt, f.Description FROM FAILURE_EVENT f JOIN ASSET a ON a.AssetID = f.AssetID ORDER BY f.OccurredAt DESC, f.FailureID DESC LIMIT 200"
      ), CACHE_TTL_SECONDS.operational, ["failures", "assets"]),
      cached("failures:asset-options", () => query<AssetOption[]>("SELECT AssetID, AssetName FROM ASSET ORDER BY AssetName, AssetID LIMIT 500"), CACHE_TTL_SECONDS.operational, ["assets"])
    ]);
  } catch {
    return <section className="dashboard-error" role="alert"><span className="eyebrow">Failure events</span><h2>Failure records unavailable</h2><p>MySQL could not provide failure event records. Check the database connection and retry.</p><Link className="button" href="/failures">Retry</Link></section>;
  }

  const canRecord = roleAllowed((await currentSession())?.role);

  return <div className="data-page">
    <header className="data-page-heading"><div><span className="eyebrow">Recorded events / MySQL source</span><h2>Failures</h2><p>Failure events as stored, ordered by recorded occurrence time.</p></div><span className="record-count">{failures.length} records shown · up to 200</span></header>
    {canRecord && <FailureForm assets={assets} />}
    <section className="reference-panel data-table-panel" aria-label="Failure events">
      {failures.length ? <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Asset</th><th>Failure type</th><th>Severity</th><th>Occurred at</th><th>Description</th></tr></thead><tbody>{failures.map((failure) => <tr key={failure.FailureID}>
        <td><Link href={`/assets/${failure.AssetID}`}>{failure.AssetName}</Link></td>
        <td>{failure.FailureType ?? "Unspecified"}</td>
        <td>{failure.Severity ?? "Unspecified"}</td>
        <td>{formatDateTime(failure.OccurredAt)}</td>
        <td>{failure.Description ?? "Unspecified"}</td>
      </tr>)}</tbody></table></div> : <div className="panel-empty"><strong>No failure events recorded</strong><span>Failure event records will appear here when present in MySQL.</span></div>}
    </section>
  </div>;
}
