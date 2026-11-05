import { NextResponse } from "next/server";
import { currentSession, hasRole } from "../../../../lib/auth";
import { logDatabaseError, withTransaction } from "../../../../lib/db";
import { stockSchema } from "../../../../lib/validation";
import { invalidate } from "../../../../lib/cache";
import { calculateStockAdjustment } from "../../../../lib/inventory-values.mjs";
import type { RowDataPacket } from "mysql2/promise";

type StockRow = RowDataPacket & { StockQuantity: number | null };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid spare-part id." }, { status: 400 });
  const parsed = stockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid inventory adjustment.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    await withTransaction(async (connection) => {
      const [rows] = await connection.execute<StockRow[]>(
        "SELECT StockQuantity FROM SPARE_PART WHERE SparePartID = ? FOR UPDATE",
        [id]
      );
      if (rows.length === 0) throw Object.assign(new Error("Spare part not found."), { code: "SPARE_PART_NOT_FOUND" });

      // NULL means the on-hand quantity is unknown, so a delta cannot be applied safely.
      const adjustment = calculateStockAdjustment(rows[0].StockQuantity, parsed.data.quantity);
      if (!adjustment.ok) {
        throw Object.assign(new Error("Inventory adjustment rejected."), { code: adjustment.reason });
      }

      await connection.execute(
        "UPDATE SPARE_PART SET StockQuantity = ?, ReorderLevel = COALESCE(?, ReorderLevel) WHERE SparePartID = ?",
        [adjustment.stockQuantity, parsed.data.reorderLevel ?? null, id]
      );
    });
    await invalidate(["inventory"]);
    return NextResponse.json({ updated: true });
  } catch (error) {
    logDatabaseError("inventory.update", error);
    if (error instanceof Error && "code" in error) {
      if (error.code === "SPARE_PART_NOT_FOUND") return NextResponse.json({ error: "Spare part not found." }, { status: 404 });
      if (error.code === "STOCK_UNSPECIFIED") return NextResponse.json({ error: "The recorded stock level is unspecified; no adjustment was applied." }, { status: 409 });
      if (error.code === "INSUFFICIENT_STOCK") return NextResponse.json({ error: "Insufficient stock for this adjustment." }, { status: 409 });
      if (error.code === "INVALID_STOCK") return NextResponse.json({ error: "The recorded stock level is invalid and must be reconciled." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update inventory." }, { status: 503 });
  }
}
