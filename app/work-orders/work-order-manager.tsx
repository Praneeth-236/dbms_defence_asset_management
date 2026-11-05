"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { displayWorkOrderStatus } from "../../lib/inventory-values.mjs";

type Order = { WorkOrderID: number; AssetName: string; Description: string | null; Priority: string | null; Status: string | null };

export default function WorkOrderManager({ orders, canOperate }: { orders: Order[]; canOperate: boolean }) {
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function update(workOrderId: number, changes: { status?: string; description?: string; priority?: string }) {
    try {
      const response = await fetch("/api/work-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId, ...changes }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Unable to update work order."); return; }
      window.location.reload();
    } catch {
      setMessage("Unable to reach the work-order service.");
    }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>, workOrderId: number) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await update(workOrderId, { description: String(values.get("description") ?? ""), priority: String(values.get("priority") ?? "") });
  }

  async function deleteWorkOrder(workOrderId: number) {
    if (!window.confirm("Permanently delete this work order? Deletion is unavailable when maintenance events reference it.")) return;
    try {
      const response = await fetch(`/api/work-orders?id=${workOrderId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Unable to delete work order."); return; }
      window.location.reload();
    } catch {
      setMessage("Unable to reach the work-order service.");
    }
  }

  return <>
    {message && <p className="muted" role="status">{message}</p>}
    <table>
      <thead><tr><th>ID</th><th>Asset</th><th>Description</th><th>Priority</th><th>Status</th><th>Maintenance</th>{canOperate && <th>Actions</th>}</tr></thead>
      <tbody>{orders.map((order) => <tr key={order.WorkOrderID}>
        <td><Link href={`/work-orders/${order.WorkOrderID}`}>{order.WorkOrderID}</Link></td>
        <td>{order.AssetName}</td>
        <td>{order.Description ?? "Unspecified"}</td>
        <td>{canOperate ? <select aria-label={`Priority for work order ${order.WorkOrderID}`} value={order.Priority ?? ""} onChange={(event) => void update(order.WorkOrderID, { priority: event.target.value })}>
          <option value="" disabled>Unspecified</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
        </select> : order.Priority ?? "Unspecified"}</td>
        <td>{canOperate ? <select aria-label={`Status for work order ${order.WorkOrderID}`} value={order.Status ?? ""} onChange={(event) => void update(order.WorkOrderID, { status: event.target.value })}>
          <option value="" disabled>{displayWorkOrderStatus(order.Status)}</option><option>Open</option><option>InProgress</option><option>Completed</option><option>Closed</option>
        </select> : <span className="pill">{displayWorkOrderStatus(order.Status)}</span>}</td>
        <td><Link className="button" href={`/work-orders/${order.WorkOrderID}#record-maintenance-event`}>{canOperate ? "Record event" : "View events"}</Link></td>
        {canOperate && <td>
          <button className="button" type="button" onClick={() => setEditingId(editingId === order.WorkOrderID ? null : order.WorkOrderID)}>{editingId === order.WorkOrderID ? "Close edit" : "Edit description"}</button>
          <button className="button danger-button" type="button" onClick={() => void deleteWorkOrder(order.WorkOrderID)}>Delete work order</button>
          {editingId === order.WorkOrderID && <form className="form" onSubmit={(event) => void saveDetails(event, order.WorkOrderID)}>
            <label>Description<textarea name="description" required minLength={3} maxLength={500} defaultValue={order.Description ?? ""} /></label>
            <label>Priority<select name="priority" required defaultValue={order.Priority ?? "Medium"}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
            <button className="button" type="submit">Save details</button>
          </form>}
        </td>}
      </tr>)}</tbody>
    </table>
    {orders.length === 0 && <div className="empty">No work orders found.</div>}
  </>;
}
