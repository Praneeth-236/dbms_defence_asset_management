import { NextResponse } from "next/server";
import { execute, logDatabaseError, query } from "../../../lib/db";
import { cached, CACHE_TTL_SECONDS, invalidate } from "../../../lib/cache";
import { currentSession, roleAllowed } from "../../../lib/auth";
import { maintenanceEventSchema } from "../../../lib/validation";
import type { RowDataPacket } from "mysql2/promise";

async function authorized() {
  const session = await currentSession();
  if (!session) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }), session: null };
  if (!roleAllowed(session.role)) return { response: NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 }), session: null };
  return { response: null, session };
}

export async function GET(request: Request) {
  const auth = await authorized();
  if (auth.response) return auth.response;
  const workOrderId = Number(new URL(request.url).searchParams.get("workOrderId"));
  if (!Number.isInteger(workOrderId) || workOrderId <= 0) return NextResponse.json({ error: "Invalid work-order id." }, { status: 400 });
  try {
    const rows = await cached(`maintenance-events:api-work-order:${workOrderId}`, () => query<RowDataPacket[]>(
      "SELECT MaintenanceID, WorkOrderID, Remarks, PerformedBy, StartDateTime, EndDateTime, MaintenanceType, ActionTaken, DowntimeHours, CostIncurred FROM MAINTENANCE_EVENT WHERE WorkOrderID = ? ORDER BY COALESCE(StartDateTime, EndDateTime) DESC, MaintenanceID DESC",
      [workOrderId]
    ), CACHE_TTL_SECONDS.operational, ["maintenance-events", "work-orders"]);
    return NextResponse.json(rows);
  } catch (error) {
    logDatabaseError("maintenance-events.list", error);
    return NextResponse.json({ error: "Unable to load maintenance events." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await authorized();
  if (auth.response || !auth.session) return auth.response;
  const parsed = maintenanceEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid maintenance-event details.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await execute(
      "INSERT INTO MAINTENANCE_EVENT (WorkOrderID, Remarks, PerformedBy, MaintenanceType, ActionTaken, CostIncurred, StartDateTime, EndDateTime, DowntimeHours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [parsed.data.workOrderId, parsed.data.remarks, auth.session.userId, parsed.data.maintenanceType, parsed.data.actionTaken, parsed.data.costIncurred, parsed.data.startDateTime ?? null, parsed.data.endDateTime ?? null, parsed.data.downtimeHours ?? null]
    );
    await invalidate(["maintenance-events"]);
    return NextResponse.json({ maintenanceId: result.insertId }, { status: 201 });
  } catch (error) {
    logDatabaseError("maintenance-events.create", error);
    if (error instanceof Error && "errno" in error && error.errno === 1644) {
      return NextResponse.json({ error: "A valid maintenance cost is required." }, { status: 400 });
    }
    if (error instanceof Error && "errno" in error && error.errno === 3819) {
      return NextResponse.json({ error: "Cost incurred must be zero or greater." }, { status: 400 });
    }
    if (error instanceof Error && "errno" in error && error.errno === 1364) {
      return NextResponse.json({ error: "Maintenance-event ID generation is not configured. Review and apply the separate MaintenanceID migration." }, { status: 503 });
    }
    if (error instanceof Error && "errno" in error && error.errno === 1452) {
      return NextResponse.json({ error: "The work order or user no longer exists." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to record the maintenance event." }, { status: 503 });
  }
}
