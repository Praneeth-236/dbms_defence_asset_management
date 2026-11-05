import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { currentSession, hasRole } from "../../../lib/auth";
import { logDatabaseError, withTransaction } from "../../../lib/db";
import { subsystemCreateSchema } from "../../../lib/validation";
import { invalidate } from "../../../lib/cache";

type IdMetadata = RowDataPacket & { EXTRA: string };
type ParentRow = RowDataPacket & { AssetID: number };

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });

  const parsed = subsystemCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subsystem details.", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const idMetadata = await withTransaction(async (connection) => {
      const [metadata] = await connection.execute<IdMetadata[]>(
        "SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'SUBSYSTEM' AND UPPER(COLUMN_NAME) = 'SUBSYSTEMID'"
      );
      if (metadata.length !== 1 || !metadata[0].EXTRA.split(/\s+/).includes("auto_increment")) return { configured: false as const };

      const [parents] = await connection.execute<ParentRow[]>("SELECT AssetID FROM ASSET WHERE AssetID = ? FOR SHARE", [parsed.data.assetId]);
      if (!parents.length) return { configured: true as const, missingAsset: true as const };

      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO SUBSYSTEM (SubsystemName, Description, CriticalityLevel, AssetID) VALUES (?, ?, ?, ?)",
        [parsed.data.subsystemName, parsed.data.description ?? null, parsed.data.criticalityLevel ?? null, parsed.data.assetId]
      );
      return { configured: true as const, missingAsset: false as const, insertId: result.insertId };
    });
    if (!idMetadata.configured) return NextResponse.json({ error: "SubsystemID generation is not configured. Apply the reviewed component hierarchy ID migration before creating records.", code: "ID_GENERATION_NOT_CONFIGURED" }, { status: 503 });
    if (idMetadata.missingAsset) return NextResponse.json({ error: "The selected asset does not exist." }, { status: 404 });
    if (!idMetadata.insertId) return NextResponse.json({ error: "The database did not generate a subsystem ID." }, { status: 503 });
    await invalidate(["hierarchy", "dependencies"]);
    return NextResponse.json({ subsystemId: idMetadata.insertId }, { status: 201 });
  } catch (error) {
    logDatabaseError("subsystems.create", error);
    const code = error && typeof error === "object" && "errno" in error ? Number(error.errno) : 0;
    if (code === 1452) return NextResponse.json({ error: "The selected asset no longer exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the subsystem." }, { status: 503 });
  }
}
