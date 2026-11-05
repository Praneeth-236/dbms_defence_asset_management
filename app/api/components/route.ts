import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { currentSession, hasRole } from "../../../lib/auth";
import { logDatabaseError, withTransaction } from "../../../lib/db";
import { componentCreateSchema } from "../../../lib/validation";
import { invalidate } from "../../../lib/cache";

type IdMetadata = RowDataPacket & { EXTRA: string };
type ParentRow = RowDataPacket & { SubsystemID: number };

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });

  const parsed = componentCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid component details.", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const idMetadata = await withTransaction(async (connection) => {
      const [metadata] = await connection.execute<IdMetadata[]>(
        "SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'COMPONENT' AND UPPER(COLUMN_NAME) = 'COMPONENTID'"
      );
      if (metadata.length !== 1 || !metadata[0].EXTRA.split(/\s+/).includes("auto_increment")) return { configured: false as const };

      const [parents] = await connection.execute<ParentRow[]>("SELECT SubsystemID FROM SUBSYSTEM WHERE SubsystemID = ? FOR SHARE", [parsed.data.subsystemId]);
      if (!parents.length) return { configured: true as const, missingSubsystem: true as const };

      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO COMPONENT (ComponentName, Description, CriticalityLevel, IsRepairable, SubsystemID) VALUES (?, ?, ?, ?, ?)",
        [parsed.data.componentName, parsed.data.description ?? null, parsed.data.criticalityLevel ?? null, parsed.data.isRepairable ?? null, parsed.data.subsystemId]
      );
      return { configured: true as const, missingSubsystem: false as const, insertId: result.insertId };
    });
    if (!idMetadata.configured) return NextResponse.json({ error: "ComponentID generation is not configured. Apply the reviewed component hierarchy ID migration before creating records.", code: "ID_GENERATION_NOT_CONFIGURED" }, { status: 503 });
    if (idMetadata.missingSubsystem) return NextResponse.json({ error: "The selected subsystem does not exist." }, { status: 404 });
    if (!idMetadata.insertId) return NextResponse.json({ error: "The database did not generate a component ID." }, { status: 503 });
    await invalidate(["hierarchy", "dependencies"]);
    return NextResponse.json({ componentId: idMetadata.insertId }, { status: 201 });
  } catch (error) {
    logDatabaseError("components.create", error);
    const code = error && typeof error === "object" && "errno" in error ? Number(error.errno) : 0;
    if (code === 1452) return NextResponse.json({ error: "The selected subsystem no longer exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the component." }, { status: 503 });
  }
}
