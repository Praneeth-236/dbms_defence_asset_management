"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

type AssetOption = { AssetID: number; AssetName: string };

export default function FailureForm({ assets }: { assets: AssetOption[] }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError(false);
    setMessage("");

    try {
      const response = await fetch("/api/failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: values.get("assetId"),
          failureType: values.get("failureType"),
          severity: values.get("severity"),
          occurredAt: values.get("occurredAt"),
          description: values.get("description")
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to record failure event.");

      form.reset();
      setMessage(`Failure event ${result.failureId} recorded.`);
      router.refresh();
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error ? submitError.message : "Unable to record failure event.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="reference-panel form-card" aria-labelledby="record-failure-title">
    <div className="reference-panel-title"><h3 id="record-failure-title">Record failure</h3></div>
    <form className="form" onSubmit={submit}>
      <label>Asset<select name="assetId" required defaultValue="" disabled={busy || assets.length === 0}>
        <option value="" disabled>Select an asset</option>
        {assets.map((asset) => <option key={asset.AssetID} value={asset.AssetID}>{asset.AssetName} (#{asset.AssetID})</option>)}
      </select></label>
      <label>Failure type <span className="muted">(optional)</span><input name="failureType" maxLength={100} disabled={busy} /></label>
      <label>Severity <span className="muted">(optional)</span><input name="severity" maxLength={20} disabled={busy} /></label>
      <label>Occurred at <span className="muted">(optional)</span><input name="occurredAt" type="datetime-local" disabled={busy} /></label>
      <label>Description <span className="muted">(optional)</span><textarea name="description" maxLength={500} rows={3} disabled={busy} /></label>
      {assets.length === 0 && <p className="muted">Create an asset before recording a failure.</p>}
      <button className="button" type="submit" disabled={busy || assets.length === 0}>{busy ? "Recording…" : "Record failure"}</button>
      {message && <p className={error ? "error-message" : "muted"} role={error ? "alert" : "status"}>{message}</p>}
    </form>
  </section>;
}
