"use client";

import { useState } from "react";
import { displayReorderLevel, displayStockQuantity } from "../../lib/inventory-values.mjs";

type Part = { SparePartID: number; PartName: string; StockQuantity: number | null; ReorderLevel: number | null };

export default function InventoryManager({ parts, canManage }: { parts: Part[]; canManage: boolean }) {
  const [message, setMessage] = useState("");
  async function adjust(part: Part) {
    const raw = window.prompt(`Adjust stock for ${part.PartName}. Use a negative number to consume stock.`);
    if (raw === null) return;
    const quantity = Number(raw);
    if (!Number.isInteger(quantity)) { setMessage("Enter a whole-number adjustment."); return; }
    const response = await fetch(`/api/inventory/${part.SparePartID}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) });
    const result = await response.json();
    setMessage(response.ok ? "Inventory updated." : result.error ?? "Unable to update inventory.");
    if (response.ok) window.location.reload();
  }
  return <>{message && <p className="muted" role="status">{message}</p>}<table><thead><tr><th>Part</th><th>Part number</th><th>Stock</th><th>Reorder level</th><th>Risk</th>{canManage && <th>Action</th>}</tr></thead><tbody>{parts.map((part) => { const low = part.StockQuantity !== null && part.ReorderLevel !== null && part.StockQuantity <= part.ReorderLevel; const stockKnown = part.StockQuantity !== null && part.ReorderLevel !== null; return <tr key={part.SparePartID}><td>{part.PartName}</td><td>{(part as Part & { PartNumber?: string }).PartNumber ?? "—"}</td><td>{displayStockQuantity(part.StockQuantity)}</td><td>{displayReorderLevel(part.ReorderLevel)}</td><td><span className={`pill ${stockKnown ? (low ? "warning" : "ready") : ""}`}>{stockKnown ? (low ? "Reorder" : "Healthy") : "Unspecified"}</span></td>{canManage && <td><button className="button" type="button" onClick={() => void adjust(part)}>Adjust stock</button></td>}</tr>; })}</tbody></table>{parts.length === 0 && <div className="empty">No spare parts found.</div>}</>;
}
