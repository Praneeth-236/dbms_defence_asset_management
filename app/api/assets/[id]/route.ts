import { NextResponse } from "next/server";
import { hasRole, currentSession } from "../../../../lib/auth";
import { execute, logDatabaseError, query, withTransaction } from "../../../../lib/db";
import { assetUpdateSchema } from "../../../../lib/validation";
import { cached, CACHE_TTL_SECONDS, invalidate } from "../../../../lib/cache";
import { isForeignKeyRestriction } from "../../../../lib/inventory-values.mjs";

type Params = { params: Promise<{ id: string }> };

async function idFrom(params: Params): Promise<number | null> {
  const id = Number((await params.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_: Request, params: Params) {
  if (!(await currentSession())) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = await idFrom(params);
  if (!id) return NextResponse.json({ error: "Invalid asset id." }, { status: 400 });
  try {
    const rows = await cached(`assets:api-detail:${id}`, () => query(
      "SELECT AssetID, AssetName, IdentificationNo, Model, MnfYear, Status, CriticalityLevel, UnitID, AssetTypeID FROM ASSET WHERE AssetID = ?",
      [id]
    ), CACHE_TTL_SECONDS.operational, ["assets"]);
    return rows.length ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Asset not found." }, { status: 404 });
  } catch (error) {
    logDatabaseError("assets.get", error);
    return NextResponse.json({ error: "Unable to load the asset." }, { status: 503 });
  }
}

export async function PATCH(request: Request, params: Params) {
  const id = await idFrom(params);
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Invalid asset id." }, { status: 400 });
  const parsed = assetUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid asset details.", issues: parsed.error.flatten() }, { status: 400 });
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  const columnMap: Record<string, string> = {
    assetName: "AssetName",
    identificationNo: "IdentificationNo",
    model: "Model",
    mnfYear: "MnfYear",
    status: "Status",
    criticalityLevel: "CriticalityLevel",
    unitId: "UnitID",
    assetTypeId: "AssetTypeID"
  };
  const assignments = fields.map(([field]) => `${columnMap[field]} = ?`);
  try {
    const existing = await query("SELECT AssetID FROM ASSET WHERE AssetID = ?", [id]);
    if (!existing.length) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    const result = await execute(`UPDATE ASSET SET ${assignments.join(", ")} WHERE AssetID = ?`, [...fields.map(([, value]) => value ?? null), id]);
    await invalidate(["assets"]);
    return NextResponse.json({ updated: true, changed: result.affectedRows > 0 });
  } catch (error) {
    logDatabaseError("assets.update", error);
    if (error instanceof Error && "errno" in error && error.errno === 1452) {
      return NextResponse.json({ error: "The selected unit or asset type does not exist." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update the asset." }, { status: 503 });
  }
}

export async function DELETE(_: Request, params: Params) {
  const id = await idFrom(params);
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Invalid asset id." }, { status: 400 });
  try {
    await withTransaction(async (connection) => {
      const [references] = await connection.execute(
        "SELECT (SELECT COUNT(*) FROM FAILURE_EVENT WHERE AssetID = ?) + (SELECT COUNT(*) FROM MAINTENANCE_WORK_ORDER WHERE AssetID = ?) + (SELECT COUNT(*) FROM SUBSYSTEM WHERE AssetID = ?) AS total",
        [id, id, id]
      );
      if (Array.isArray(references) && Number((references[0] as { total: number }).total) > 0) {
        const error = new Error("Asset has dependent records.") as Error & { code?: string };
        error.code = "ASSET_HAS_DEPENDENCIES";
        throw error;
      }
      const [result] = await connection.execute("DELETE FROM ASSET WHERE AssetID = ?", [id]);
      if ("affectedRows" in result && result.affectedRows === 0) {
        const error = new Error("Asset not found.") as Error & { code?: string };
        error.code = "ASSET_NOT_FOUND";
        throw error;
      }
    });
    await invalidate(["assets"]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logDatabaseError("assets.delete", error);
    if (error instanceof Error && "code" in error && error.code === "ASSET_HAS_DEPENDENCIES") {
      return NextResponse.json({ error: "This asset has dependent records and cannot be deleted." }, { status: 409 });
    }
    if (error instanceof Error && "code" in error && error.code === "ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }
    if (isForeignKeyRestriction(error)) {
      return NextResponse.json({ error: "This asset has dependent records and cannot be deleted." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to delete the asset." }, { status: 503 });
  }
}
