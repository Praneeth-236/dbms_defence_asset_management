import { NextResponse } from "next/server";
import { invalidate } from "../../../lib/cache";
import { currentSession, roleAllowed } from "../../../lib/auth";
import { logDatabaseError, withTransaction } from "../../../lib/db";
import { failureEventSchema } from "../../../lib/validation";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type FailureDatabaseError = Error & { code?: string; errno?: number };

function failureDatabaseError(code: string): FailureDatabaseError {
  const error = new Error(code) as FailureDatabaseError;
  error.code = code;
  return error;
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!roleAllowed(session.role)) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });

  const parsed = failureEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid failure-event details.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const failureId = await withTransaction(async (connection) => {
      const [idColumns] = await connection.execute<RowDataPacket[]>(
        "SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND UPPER(TABLE_NAME) = 'FAILURE_EVENT' AND UPPER(COLUMN_NAME) = 'FAILUREID'"
      );
      if (idColumns.length !== 1 || !String(idColumns[0].EXTRA).toLowerCase().includes("auto_increment")) {
        throw failureDatabaseError("FAILURE_ID_GENERATION_NOT_CONFIGURED");
      }

      const [assetRows] = await connection.execute<RowDataPacket[]>(
        "SELECT AssetID FROM ASSET WHERE AssetID = ? FOR SHARE",
        [parsed.data.assetId]
      );
      if (assetRows.length === 0) throw failureDatabaseError("ASSET_NOT_FOUND");

      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO FAILURE_EVENT (FailureType, Severity, OccurredAt, Description, AssetID) VALUES (?, ?, ?, ?, ?)",
        [
          parsed.data.failureType ?? null,
          parsed.data.severity ?? null,
          parsed.data.occurredAt ?? null,
          parsed.data.description ?? null,
          parsed.data.assetId
        ]
      );
      return result.insertId;
    });

    if (!Number.isSafeInteger(failureId) || failureId <= 0) {
      logDatabaseError("failures.create", new Error("MySQL did not return a valid generated FailureID."));
      return NextResponse.json({ error: "The database did not return a generated failure ID." }, { status: 503 });
    }

    await invalidate(["failures"]);
    return NextResponse.json({ failureId }, { status: 201 });
  } catch (error) {
    logDatabaseError("failures.create", error);
    const databaseError = error as FailureDatabaseError;
    if (databaseError.code === "ASSET_NOT_FOUND" || databaseError.errno === 1452) {
      return NextResponse.json({ error: "The selected asset does not exist." }, { status: 400 });
    }
    if (databaseError.code === "FAILURE_ID_GENERATION_NOT_CONFIGURED" || databaseError.errno === 1364 || databaseError.code === "ER_NO_DEFAULT_FOR_FIELD") {
      return NextResponse.json({
        error: "FailureID is not configured for database generation. Review and apply migration 005 before recording failures."
      }, { status: 503 });
    }
    if (databaseError.errno === 1062 || databaseError.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "The database could not generate a unique failure ID. Contact an administrator." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to record the failure event." }, { status: 503 });
  }
}
