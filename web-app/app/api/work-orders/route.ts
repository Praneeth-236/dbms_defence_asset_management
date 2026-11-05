import { NextResponse } from "next/server";
import { execute, logDatabaseError, query, withTransaction } from "../../../lib/db";
import { cached, CACHE_TTL_SECONDS, invalidate } from "../../../lib/cache";
import { workOrderSchema, workOrderUpdateSchema } from "../../../lib/validation";
import { currentSession, roleAllowed } from "../../../lib/auth";

async function authorized() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!roleAllowed(session.role)) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await authorized();
  if (denied) return denied;
  try {
    const rows = await cached("work-orders:api-list", () => query("SELECT wo.WorkOrderID, wo.AssetID, a.AssetName, wo.Description, wo.OrderDate, wo.Priority, wo.Status FROM MAINTENANCE_WORK_ORDER wo JOIN ASSET a ON a.AssetID = wo.AssetID ORDER BY wo.OrderDate DESC, wo.WorkOrderID DESC LIMIT 200"), CACHE_TTL_SECONDS.operational, ["work-orders", "assets"]);
    return NextResponse.json(rows);
  } catch (error) {
    logDatabaseError("work-orders.list", error);
    return NextResponse.json({ error: "Unable to load work orders." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await authorized();
  if (denied) return denied;
  const parsed = workOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid work-order details.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await withTransaction(async (connection) => {
      const [assetRows] = await connection.execute("SELECT AssetID FROM ASSET WHERE AssetID = ? FOR SHARE", [parsed.data.assetId]);
      if (!Array.isArray(assetRows) || assetRows.length === 0) {
        const error = new Error("The selected asset does not exist.") as Error & { code?: string };
        error.code = "ASSET_NOT_FOUND";
        throw error;
      }
      const [inserted] = await connection.execute(
        "INSERT INTO MAINTENANCE_WORK_ORDER (AssetID, Description, OrderDate, Priority, Status) VALUES (?, ?, ?, ?, ?)",
        [parsed.data.assetId, parsed.data.description, parsed.data.orderDate, parsed.data.priority, parsed.data.status]
      );
      return inserted as { insertId: number };
    });
    await invalidate(["work-orders", "assets"]);
    return NextResponse.json({ workOrderId: result.insertId }, { status: 201 });
  } catch (error) {
    logDatabaseError("work-orders.create", error);
    if (error instanceof Error && "code" in error && error.code === "ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "The selected asset does not exist." }, { status: 400 });
    }
    if (error instanceof Error && "errno" in error && error.errno === 1364) {
      return NextResponse.json({ error: "Work-order ID generation is not configured. Review and apply the work-order ID migration." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to create work order." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await authorized();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = Number(body?.workOrderId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid work-order id." }, { status: 400 });
  const parsed = workOrderUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid work-order details.", issues: parsed.error.flatten() }, { status: 400 });
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  const columnMap: Record<string, string> = { status: "Status", priority: "Priority", description: "Description" };
  try {
    const existing = await query("SELECT WorkOrderID FROM MAINTENANCE_WORK_ORDER WHERE WorkOrderID = ?", [id]);
    if (!existing.length) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    const result = await execute(
      `UPDATE MAINTENANCE_WORK_ORDER SET ${fields.map(([key]) => `${columnMap[key]} = ?`).join(", ")} WHERE WorkOrderID = ?`,
      [...fields.map(([, value]) => value), id]
    );
    await invalidate(["work-orders", "assets"]);
    return NextResponse.json({ updated: true, changed: result.affectedRows > 0 });
  } catch (error) {
    logDatabaseError("work-orders.update", error);
    return NextResponse.json({ error: "Unable to update the work order." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denied = await authorized();
  if (denied) return denied;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid work-order id." }, { status: 400 });
  try {
    const references = await query("SELECT COUNT(*) AS total FROM MAINTENANCE_EVENT WHERE WorkOrderID = ?", [id]);
    if (Number(references[0]?.total ?? 0) > 0) return NextResponse.json({ error: "Work order has maintenance events and cannot be deleted." }, { status: 409 });
    const result = await execute("DELETE FROM MAINTENANCE_WORK_ORDER WHERE WorkOrderID = ?", [id]);
    if (!result.affectedRows) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    await invalidate(["work-orders", "assets"]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logDatabaseError("work-orders.delete", error);
    if (error instanceof Error && "errno" in error && error.errno === 1451) {
      return NextResponse.json({ error: "Work order has maintenance events and cannot be deleted." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to cancel the work order." }, { status: 503 });
  }
}
