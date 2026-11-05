"use client";

import Link from "next/link";
import { useState } from "react";

type Asset = { AssetID: number; AssetName: string; IdentificationNo: string | null; Model: string | null; MnfYear: number | null; Status: string | null; CriticalityLevel: string | null; UnitName: string; ServiceName: string };
type UnitOption = { UnitID: number; UnitName: string };
type AssetTypeOption = { AssetTypeID: number; AssetTypeName: string };

export default function AssetManager({ initialAssets, initialSearch = "", units, assetTypes, canManage }: { initialAssets: Asset[]; initialSearch?: string; units: UnitOption[]; assetTypes: AssetTypeOption[]; canManage: boolean }) {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState(initialSearch);
  const [message, setMessage] = useState("");
  const emptyForm = { assetName: "", identificationNo: "", model: "", mnfYear: "", status: "", criticalityLevel: "", unitId: "", assetTypeId: "" };
  const [form, setForm] = useState(emptyForm);

  async function refresh(nextSearch = search) {
    const response = await fetch(`/api/assets?q=${encodeURIComponent(nextSearch)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to load assets.");
    setAssets(result);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Creating asset...");
    try {
      const response = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Unable to create asset."); return; }
      setForm(emptyForm);
      await refresh();
      setMessage(`Asset ${result.assetId} created and list refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Asset created, but the list could not be refreshed: ${error.message}` : "Asset created, but the list could not be refreshed.");
    }
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`Delete ${asset.AssetName}? This cannot remove assets with dependent records.`)) return;
    const response = await fetch(`/api/assets/${asset.AssetID}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Asset deleted." : result.error ?? "Unable to delete asset.");
    if (response.ok) await refresh();
  }

  async function updateStatus(asset: Asset, status: string) {
    const response = await fetch(`/api/assets/${asset.AssetID}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json();
    setMessage(response.ok ? "Asset updated." : result.error ?? "Unable to update asset.");
    if (response.ok) await refresh();
  }

  return <>
    <section className="card">
      <form className="form" onSubmit={(event) => { event.preventDefault(); void refresh().catch((error) => setMessage(error.message)); }}>
        <label>Search assets<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or model" /></label>
        <button className="button" type="submit">Search</button>
      </form>
    </section>
    {canManage && <section className="card">
      <h2>Create asset</h2>
      <form className="form" onSubmit={create}>
        <label>Name<input required maxLength={100} value={form.assetName} onChange={(event) => setForm({ ...form, assetName: event.target.value })} /></label>
        <label>Identification number<input maxLength={100} value={form.identificationNo} onChange={(event) => setForm({ ...form, identificationNo: event.target.value })} /></label>
        <label>Model<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
        <label>Manufacture year<input type="number" min="1" max="9999" step="1" value={form.mnfYear} onChange={(event) => setForm({ ...form, mnfYear: event.target.value })} /></label>
        <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="">Unspecified</option><option>Ready</option><option>Degraded</option><option>Unavailable</option></select></label>
        <label>Criticality<select value={form.criticalityLevel} onChange={(event) => setForm({ ...form, criticalityLevel: event.target.value })}><option value="">Unspecified</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
        <label>Unit<select required value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })}><option value="">Select a unit</option>{units.map((unit) => <option key={unit.UnitID} value={unit.UnitID}>{unit.UnitName}</option>)}</select></label>
        <label>Asset type<select required value={form.assetTypeId} onChange={(event) => setForm({ ...form, assetTypeId: event.target.value })}><option value="">Select an asset type</option>{assetTypes.map((assetType) => <option key={assetType.AssetTypeID} value={assetType.AssetTypeID}>{assetType.AssetTypeName}</option>)}</select></label>
        <button className="button" type="submit">Create asset</button>
        {message && <p className="muted" role="status">{message}</p>}
      </form>
    </section>}
    <div className="card table-wrap"><table><thead><tr><th>Asset</th><th>Identification no.</th><th>Model</th><th>Year</th><th>Unit</th><th>Service</th><th>Status</th><th>Criticality</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.AssetID}><td><Link href={`/assets/${asset.AssetID}`}>{asset.AssetName}</Link></td><td>{asset.IdentificationNo ?? "Unspecified"}</td><td>{asset.Model ?? "Unspecified"}</td><td>{asset.MnfYear ?? "Unspecified"}</td><td>{asset.UnitName}</td><td>{asset.ServiceName}</td><td>{canManage ? <select value={asset.Status ?? ""} onChange={(event) => void updateStatus(asset, event.target.value)}><option value="">Unspecified</option><option>Ready</option><option>Degraded</option><option>Unavailable</option></select> : <span className="pill">{asset.Status ?? "Unspecified"}</span>}</td><td>{asset.CriticalityLevel ?? "Unspecified"}</td>{canManage && <td><button className="button danger-button" type="button" onClick={() => void remove(asset)}>Delete</button></td>}</tr>)}</tbody></table>{assets.length === 0 && <div className="empty">No assets found.</div>}</div>
  </>;
}
