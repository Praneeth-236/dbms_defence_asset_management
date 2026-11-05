"use client";

import { FormEvent, useState } from "react";

export default function MaintenanceEventForm({ workOrderId }: { workOrderId: number }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/maintenance-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId,
          maintenanceType: formData.get("maintenanceType"),
          actionTaken: formData.get("actionTaken"),
          remarks: formData.get("remarks"),
          costIncurred: formData.get("costIncurred"),
          startDateTime: formData.get("startDateTime"),
          endDateTime: formData.get("endDateTime"),
          downtimeHours: formData.get("downtimeHours")
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to record maintenance event.");
      form.reset();
      setMessage("Maintenance event recorded.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record maintenance event.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="form" onSubmit={submit}>
    <label>Maintenance type<input name="maintenanceType" maxLength={50} required /></label>
    <label>Action taken<textarea name="actionTaken" maxLength={500} rows={2} /></label>
    <label>Remarks<textarea name="remarks" maxLength={500} rows={2} /></label>
    <label>Started at<input name="startDateTime" type="datetime-local" /></label>
    <label>Ended at<input name="endDateTime" type="datetime-local" /></label>
    <label>Downtime (hours)<input name="downtimeHours" type="text" inputMode="decimal" maxLength={12} pattern="-?[0-9]+(\.[0-9]{1,2})?" /></label>
    <p className="muted">Dates are stored as local wall time. Downtime accepts values fitting DECIMAL(10,2).</p>
    <label>Cost incurred<input name="costIncurred" type="text" inputMode="decimal" maxLength={16} pattern="[0-9]+(\.[0-9]{1,2})?" required aria-describedby="maintenance-cost-help" /></label>
    <p id="maintenance-cost-help" className="muted">Required. Enter zero or a positive amount, up to 13 integer digits and 2 decimal places.</p>
    <button className="button" type="submit" disabled={busy}>{busy ? "Recording…" : "Record event"}</button>
    {message && <p className="muted" role="status">{message}</p>}
  </form>;
}
