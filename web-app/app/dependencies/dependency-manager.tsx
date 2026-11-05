"use client";

import { useState } from "react";

type Dependency = { ComponentID: number; DependsOnComponentID: number; ComponentName: string; DependsOn: string };
type Component = { ComponentID: number; ComponentName: string };

export default function DependencyManager({ initialDependencies, components, canManage }: { initialDependencies: Dependency[]; components: Component[]; canManage: boolean }) {
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ componentId: "", dependsOnComponentId: "" });
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/dependencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    setMessage(response.ok ? "Dependency created." : result.error ?? "Unable to create dependency.");
    if (response.ok) window.location.reload();
  }
  async function remove(row: Dependency) {
    if (!window.confirm(`Remove ${row.ComponentName} -> ${row.DependsOn}?`)) return;
    const response = await fetch(`/api/dependencies?componentId=${row.ComponentID}&dependsOnComponentId=${row.DependsOnComponentID}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Dependency removed." : result.error ?? "Unable to remove dependency.");
    if (response.ok) window.location.reload();
  }
  return <>{canManage && <form className="form" onSubmit={create}><label>Component<select required value={form.componentId} onChange={(event) => setForm({ ...form, componentId: event.target.value })}><option value="">Select</option>{components.map((component) => <option key={component.ComponentID} value={component.ComponentID}>{component.ComponentName}</option>)}</select></label><label>Depends on<select required value={form.dependsOnComponentId} onChange={(event) => setForm({ ...form, dependsOnComponentId: event.target.value })}><option value="">Select</option>{components.map((component) => <option key={component.ComponentID} value={component.ComponentID}>{component.ComponentName}</option>)}</select></label><button className="button" type="submit">Add dependency</button></form>}{message && <p className="muted" role="status">{message}</p>}<table><thead><tr><th>Component</th><th>Depends on</th>{canManage && <th>Action</th>}</tr></thead><tbody>{initialDependencies.map((row) => <tr key={`${row.ComponentID}-${row.DependsOnComponentID}`}><td>{row.ComponentName}</td><td>{row.DependsOn}</td>{canManage && <td><button className="button danger-button" type="button" onClick={() => void remove(row)}>Remove</button></td>}</tr>)}</tbody></table>{initialDependencies.length === 0 && <div className="empty">No dependency mappings found.</div>}</>;
}
