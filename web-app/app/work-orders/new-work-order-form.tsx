"use client";

import { FormEvent, useState } from "react";

type AssetOption = { AssetID: number; AssetName: string };

export default function NewWorkOrderForm({ assets }: { assets: AssetOption[] }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("Saving...");
    const body = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    setMessage(response.ok ? `Created work order ${result.workOrderId}. Refresh to view it.` : result.error ?? "Unable to save.");
    if (response.ok) {
      form.reset();
      window.location.reload();
    }
  }
  return <form className="form" onSubmit={submit}><label>Asset<select name="assetId" required defaultValue=""><option value="" disabled>Select an asset</option>{assets.map((asset) => <option key={asset.AssetID} value={asset.AssetID}>{asset.AssetName} (#{asset.AssetID})</option>)}</select></label><label>Description<input name="description" maxLength={500} required /></label><label>Order date<input name="orderDate" type="date" required /></label><label>Priority<select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Status<select name="status" defaultValue="Open"><option>Open</option><option>InProgress</option><option>Completed</option><option>Closed</option></select></label><button className="button" type="submit" disabled={assets.length === 0}>Create work order</button>{assets.length === 0 && <p className="muted">Create an asset before opening a work order.</p>}{message && <p className="muted" role="status">{message}</p>}</form>;
}
