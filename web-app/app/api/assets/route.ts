import { NextResponse } from "next/server";
import { query, withTransaction } from "../../../lib/db";
import { currentSession, hasRole } from "../../../lib/auth";
import { assetSchema } from "../../../lib/validation";
import { logDatabaseError } from "../../../lib/db";
import { cached, CACHE_TTL_SECONDS, invalidate } from "../../../lib/cache";
import { searchSchema } from "../../../lib/validation";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type AssetDatabaseError = Error & { code?: string; errno?: number };

function assetDatabaseError(code: string, message: string): AssetDatabaseError {
  const error = new Error(message) as AssetDatabaseError;
  error.code = code;
  return error;
}

export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsedSearch = searchSchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? undefined });
  if (!parsedSearch.success) return NextResponse.json({ error: "Search query must be 100 characters or fewer." }, { status: 400 });
  const search = parsedSearch.data.q ?? "";
  try {
    const assets = await cached(`assets:api-list:${search}`, () => query(
      "SELECT a.AssetID, a.AssetName, a.IdentificationNo, a.Model, a.MnfYear, a.Status, a.CriticalityLevel, u.UnitName, s.ServiceName FROM ASSET a JOIN UNIT u ON u.UnitID = a.UnitID JOIN SERVICE s ON s.ServiceID = u.ServiceID WHERE a.AssetName LIKE ? OR a.Model LIKE ? OR a.IdentificationNo LIKE ? ORDER BY a.AssetID LIMIT 200",
      [`%${search}%`, `%${search}%`, `%${search}%`]
    ), CACHE_TTL_SECONDS.operational, ["assets"]);
    return NextResponse.json(assets);
  } catch (error) {
    logDatabaseError("assets.list", error);
    return NextResponse.json({ error: "Unable to load assets." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  const parsed = assetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid asset details.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const assetId = await withTransaction(async (connection) => {
      const [unitRows] = await connection.execute<RowDataPacket[]>("SELECT UnitID FROM UNIT WHERE UnitID = ? FOR SHARE", [parsed.data.unitId]);
      if (unitRows.length === 0) throw assetDatabaseError("ASSET_UNIT_NOT_FOUND", "The selected unit does not exist.");

      const [assetTypeRows] = await connection.execute<RowDataPacket[]>("SELECT AssetTypeID FROM ASSET_TYPE WHERE AssetTypeID = ? FOR SHARE", [parsed.data.assetTypeId]);
      if (assetTypeRows.length === 0) throw assetDatabaseError("ASSET_TYPE_NOT_FOUND", "The selected asset type does not exist.");

      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO ASSET (AssetName, IdentificationNo, Model, MnfYear, Status, CriticalityLevel, UnitID, AssetTypeID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [parsed.data.assetName, parsed.data.identificationNo ?? null, parsed.data.model ?? null, parsed.data.mnfYear ?? null, parsed.data.status ?? null, parsed.data.criticalityLevel ?? null, parsed.data.unitId, parsed.data.assetTypeId]
      );
      return result.insertId;
    });
    await invalidate(["assets"]);
    return NextResponse.json({ assetId }, { status: 201 });
  } catch (error) {
    logDatabaseError("assets.create", error);
    const databaseError = error as AssetDatabaseError;
    if (databaseError.code === "ASSET_UNIT_NOT_FOUND" || databaseError.code === "ASSET_TYPE_NOT_FOUND") {
      return NextResponse.json({ error: databaseError.message }, { status: 400 });
    }
    if (databaseError.code === "ER_DUP_ENTRY" || databaseError.errno === 1062) {
      return NextResponse.json({ error: "The asset could not be assigned a unique ID. Please try again." }, { status: 409 });
    }
    if (databaseError.code === "ER_NO_DEFAULT_FOR_FIELD" || databaseError.errno === 1364) {
      return NextResponse.json({ error: "Asset ID generation is not configured in the database. Apply the asset ID migration." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to create the asset." }, { status: 503 });
  }
}
