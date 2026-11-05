import { NextResponse } from "next/server";
import { currentSession, hasRole } from "../../../../lib/auth";
import { execute, logDatabaseError, query } from "../../../../lib/db";
import { isForeignKeyRestriction } from "../../../../lib/inventory-values.mjs";
import { componentUpdateSchema } from "../../../../lib/validation";
import { invalidate } from "../../../../lib/cache";

type Params = { params: Promise<{ id: string }> };

async function authorized() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  return null;
}

async function idFrom(params: Params): Promise<number | null> {
  const id = Number((await params.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, params: Params) {
  const denied = await authorized();
  if (denied) return denied;
  const id = await idFrom(params);
  if (!id) return NextResponse.json({ error: "Invalid component id." }, { status: 400 });
  const parsed = componentUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid component details.", issues: parsed.error.flatten() }, { status: 400 });

  const columns: Record<string, string> = { componentName: "ComponentName", description: "Description", criticalityLevel: "CriticalityLevel", isRepairable: "IsRepairable" };
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  try {
    const existing = await query("SELECT ComponentID FROM COMPONENT WHERE ComponentID = ?", [id]);
    if (!existing.length) return NextResponse.json({ error: "Component not found." }, { status: 404 });
    await execute(`UPDATE COMPONENT SET ${fields.map(([key]) => `${columns[key]} = ?`).join(", ")} WHERE ComponentID = ?`, [...fields.map(([, value]) => value ?? null), id]);
    await invalidate(["hierarchy", "dependencies"]);
    return NextResponse.json({ updated: true });
  } catch (error) {
    logDatabaseError("components.update", error);
    return NextResponse.json({ error: "Unable to update the component." }, { status: 503 });
  }
}

export async function DELETE(_: Request, params: Params) {
  const denied = await authorized();
  if (denied) return denied;
  const id = await idFrom(params);
  if (!id) return NextResponse.json({ error: "Invalid component id." }, { status: 400 });
  try {
    const result = await execute("DELETE FROM COMPONENT WHERE ComponentID = ?", [id]);
    if (!result.affectedRows) return NextResponse.json({ error: "Component not found." }, { status: 404 });
    await invalidate(["hierarchy", "dependencies"]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logDatabaseError("components.delete", error);
    if (isForeignKeyRestriction(error)) return NextResponse.json({ error: "This component is referenced by dependency or spare-part records and cannot be deleted." }, { status: 409 });
    return NextResponse.json({ error: "Unable to delete the component." }, { status: 503 });
  }
}
