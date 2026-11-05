"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Subsystem = { SubsystemID: number; SubsystemName: string; Description: string | null; CriticalityLevel: string | null };
type Component = { ComponentID: number; SubsystemID: number; ComponentName: string; Description: string | null; CriticalityLevel: string | null; IsRepairable: string | null };
type Notice = { text: string; error: boolean };

export default function AssetHierarchyManager({ assetId, subsystems, components, canManage, idGenerationReady }: {
  assetId: number;
  subsystems: Subsystem[];
  components: Component[];
  canManage: boolean;
  idGenerationReady: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [creatingSubsystem, setCreatingSubsystem] = useState(false);
  const [creatingComponentFor, setCreatingComponentFor] = useState<number | null>(null);
  const [editingSubsystem, setEditingSubsystem] = useState<number | null>(null);
  const [editingComponent, setEditingComponent] = useState<number | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, url: string, method: "POST" | "PATCH", success: (id?: number) => string) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(url);
    setNotice({ text: "Saving changes…", error: false });
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ text: result.error ?? "Unable to save these details.", error: true });
        return;
      }
      form.reset();
      setCreatingSubsystem(false);
      setCreatingComponentFor(null);
      setEditingSubsystem(null);
      setEditingComponent(null);
      setNotice({ text: success(result.subsystemId ?? result.componentId), error: false });
      router.refresh();
    } catch {
      setNotice({ text: "The request could not reach the server. Check your connection and try again.", error: true });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function remove(url: string, description: string) {
    if (!window.confirm(`Delete ${description}? Linked components, dependencies, or spare-part records may prevent deletion.`)) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(url);
    setNotice({ text: "Deleting…", error: false });
    try {
      const response = await fetch(url, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ text: result.error ?? `Unable to delete ${description}.`, error: true });
        return;
      }
      setNotice({ text: `${description} deleted.`, error: false });
      router.refresh();
    } catch {
      setNotice({ text: `The request could not reach the server. ${description} was not confirmed deleted.`, error: true });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return <div className="hierarchy-manager">
    <p className="muted">The current schema stores this hierarchy as Asset → Subsystem → Component. Components have no status field or component-to-component parent relationship.</p>
    {notice && <p className={notice.error ? "error hierarchy-notice" : "hierarchy-notice"} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {canManage && !idGenerationReady && <p className="error hierarchy-notice" role="status">Creation is unavailable because SubsystemID and ComponentID are not configured for database-generated values. Review and apply the component hierarchy ID migration first.</p>}
    {canManage && <div className="hierarchy-toolbar">
      <button className="button" type="button" disabled={!idGenerationReady || busy !== null} onClick={() => setCreatingSubsystem((open) => !open)}>
        {creatingSubsystem ? "Close subsystem form" : "Add subsystem"}
      </button>
    </div>}
    {canManage && creatingSubsystem && <form className="form hierarchy-form" onSubmit={(event) => void submit(event, "/api/subsystems", "POST", (id) => `Subsystem ${id ?? ""} created.`)}>
      <h3>Add a subsystem to this asset</h3>
      <input type="hidden" name="assetId" value={assetId} />
      <label>Subsystem name<input name="subsystemName" required maxLength={100} /></label>
      <label>Description<input name="description" maxLength={255} /></label>
      <label>Criticality level<input name="criticalityLevel" maxLength={20} /></label>
      <button className="button" type="submit" disabled={busy !== null}>{busy ? "Saving…" : "Save subsystem"}</button>
    </form>}

    {subsystems.length === 0 ? <div className="empty">No subsystems are linked to this asset.</div> : <div className="hierarchy-list">
      {subsystems.map((subsystem) => {
        const members = components.filter((component) => component.SubsystemID === subsystem.SubsystemID);
        return <details className="hierarchy-node" key={subsystem.SubsystemID} open>
          <summary>
            <span><strong>{subsystem.SubsystemName}</strong><small>Subsystem #{subsystem.SubsystemID} · {members.length} component{members.length === 1 ? "" : "s"}</small></span>
          </summary>
          <dl className="hierarchy-details">
            <div><dt>Description</dt><dd>{subsystem.Description ?? "Unspecified"}</dd></div>
            <div><dt>Criticality</dt><dd>{subsystem.CriticalityLevel ?? "Unspecified"}</dd></div>
          </dl>
          {canManage && <div className="hierarchy-actions">
            <button className="button" type="button" disabled={busy !== null} onClick={() => { setEditingSubsystem(editingSubsystem === subsystem.SubsystemID ? null : subsystem.SubsystemID); setCreatingComponentFor(null); }}>Edit subsystem</button>
            <button className="button danger-button" type="button" disabled={busy !== null} onClick={() => void remove(`/api/subsystems/${subsystem.SubsystemID}`, `subsystem ${subsystem.SubsystemName}`)}>Delete subsystem</button>
            <button className="button" type="button" disabled={!idGenerationReady || busy !== null} onClick={() => setCreatingComponentFor(creatingComponentFor === subsystem.SubsystemID ? null : subsystem.SubsystemID)}>Add component</button>
          </div>}
          {canManage && editingSubsystem === subsystem.SubsystemID && <form className="form hierarchy-form" onSubmit={(event) => void submit(event, `/api/subsystems/${subsystem.SubsystemID}`, "PATCH", () => "Subsystem details updated.")}>
            <h3>Edit subsystem</h3>
            <label>Name<input name="subsystemName" required maxLength={100} defaultValue={subsystem.SubsystemName} /></label>
            <label>Description<input name="description" maxLength={255} defaultValue={subsystem.Description ?? ""} /></label>
            <label>Criticality level<input name="criticalityLevel" maxLength={20} defaultValue={subsystem.CriticalityLevel ?? ""} /></label>
            <div className="hierarchy-actions"><button className="button" type="submit" disabled={busy !== null}>{busy ? "Saving…" : "Save subsystem"}</button><button className="button" type="button" onClick={() => setEditingSubsystem(null)}>Close</button></div>
          </form>}
          {canManage && creatingComponentFor === subsystem.SubsystemID && <form className="form hierarchy-form" onSubmit={(event) => void submit(event, "/api/components", "POST", (id) => `Component ${id ?? ""} created.`)}>
            <h3>Add a component under {subsystem.SubsystemName}</h3>
            <input type="hidden" name="subsystemId" value={subsystem.SubsystemID} />
            <label>Component name<input name="componentName" required maxLength={100} /></label>
            <label>Description<input name="description" maxLength={255} /></label>
            <label>Criticality level<input name="criticalityLevel" maxLength={20} /></label>
            <label>Repairable value<input name="isRepairable" maxLength={5} placeholder="Schema value" /></label>
            <button className="button" type="submit" disabled={busy !== null}>{busy ? "Saving…" : "Save component"}</button>
          </form>}
          {members.length === 0 ? <div className="empty hierarchy-empty">No components are recorded under this subsystem.</div> : <div className="hierarchy-children">
            {members.map((component) => <details className="hierarchy-node hierarchy-child" key={component.ComponentID}>
              <summary>
                <span><strong>{component.ComponentName}</strong><small>Component #{component.ComponentID}</small></span>
              </summary>
              <dl className="hierarchy-details">
                <div><dt>Subsystem</dt><dd>{subsystem.SubsystemName} (#{subsystem.SubsystemID})</dd></div>
                <div><dt>Description</dt><dd>{component.Description ?? "Unspecified"}</dd></div>
                <div><dt>Criticality</dt><dd>{component.CriticalityLevel ?? "Unspecified"}</dd></div>
                <div><dt>Repairable</dt><dd>{component.IsRepairable ?? "Unspecified"}</dd></div>
                <div><dt>Status</dt><dd>Not recorded in the current schema</dd></div>
              </dl>
              {canManage && <div className="hierarchy-actions">
                <button className="button" type="button" disabled={busy !== null} onClick={() => setEditingComponent(editingComponent === component.ComponentID ? null : component.ComponentID)}>Edit component</button>
                <button className="button danger-button" type="button" disabled={busy !== null} onClick={() => void remove(`/api/components/${component.ComponentID}`, `component ${component.ComponentName}`)}>Delete component</button>
              </div>}
              {canManage && editingComponent === component.ComponentID && <form className="form hierarchy-form" onSubmit={(event) => void submit(event, `/api/components/${component.ComponentID}`, "PATCH", () => "Component details updated.")}>
                <h3>Edit component</h3>
                <label>Name<input name="componentName" required maxLength={100} defaultValue={component.ComponentName} /></label>
                <label>Description<input name="description" maxLength={255} defaultValue={component.Description ?? ""} /></label>
                <label>Criticality level<input name="criticalityLevel" maxLength={20} defaultValue={component.CriticalityLevel ?? ""} /></label>
                <label>Repairable value<input name="isRepairable" maxLength={5} defaultValue={component.IsRepairable ?? ""} /></label>
                <div className="hierarchy-actions"><button className="button" type="submit" disabled={busy !== null}>{busy ? "Saving…" : "Save component"}</button><button className="button" type="button" onClick={() => setEditingComponent(null)}>Close</button></div>
              </form>}
            </details>)}
          </div>}
        </details>;
      })}
    </div>}
  </div>;
}
