import { NextResponse } from "next/server";
import { currentSession, hasRole } from "../../../lib/auth";
import { execute, logDatabaseError, query, withTransaction } from "../../../lib/db";
import { dependencySchema } from "../../../lib/validation";
import { cached, CACHE_TTL_SECONDS, invalidate } from "../../../lib/cache";

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const [dependencies, components] = await Promise.all([
      cached("dependencies:api-list", () => query("SELECT cd.ComponentID, cd.DependsOnComponentID, c1.ComponentName, c2.ComponentName AS DependsOn FROM COMPONENT_DEPENDENCY cd JOIN COMPONENT c1 ON c1.ComponentID = cd.ComponentID JOIN COMPONENT c2 ON c2.ComponentID = cd.DependsOnComponentID ORDER BY c1.ComponentName, c2.ComponentName"), CACHE_TTL_SECONDS.operational, ["dependencies", "hierarchy"]),
      cached("dependencies:api-component-options", () => query("SELECT ComponentID, ComponentName FROM COMPONENT ORDER BY ComponentName"), CACHE_TTL_SECONDS.operational, ["hierarchy"])
    ]);
    return NextResponse.json({ dependencies, components });
  } catch (error) {
    logDatabaseError("dependencies.list", error);
    return NextResponse.json({ error: "Unable to load dependencies." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  const parsed = dependencySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid dependency.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    await withTransaction(async (connection) => {
      const [components] = await connection.execute("SELECT ComponentID FROM COMPONENT WHERE ComponentID IN (?, ?)", [parsed.data.componentId, parsed.data.dependsOnComponentId]);
      if (!Array.isArray(components) || components.length !== 2) throw Object.assign(new Error("Component not found."), { code: "COMPONENT_NOT_FOUND" });
      const [edges] = await connection.execute("SELECT ComponentID, DependsOnComponentID FROM COMPONENT_DEPENDENCY");
      const graph = new Map<number, number[]>();
      for (const edge of edges as Array<{ ComponentID: number; DependsOnComponentID: number }>) {
        graph.set(edge.ComponentID, [...(graph.get(edge.ComponentID) ?? []), edge.DependsOnComponentID]);
      }
      const stack = [parsed.data.dependsOnComponentId];
      const seen = new Set<number>();
      while (stack.length) {
        const current = stack.pop() as number;
        if (current === parsed.data.componentId) throw Object.assign(new Error("Circular dependency."), { code: "CIRCULAR_DEPENDENCY" });
        if (seen.has(current)) continue;
        seen.add(current);
        stack.push(...(graph.get(current) ?? []));
      }
      await connection.execute("INSERT INTO COMPONENT_DEPENDENCY (ComponentID, DependsOnComponentID) VALUES (?, ?)", [parsed.data.componentId, parsed.data.dependsOnComponentId]);
    });
    await invalidate(["dependencies"]);
    return NextResponse.json({ created: true }, { status: 201 });
  } catch (error) {
    logDatabaseError("dependencies.create", error);
    if (error instanceof Error && "code" in error && error.code === "CIRCULAR_DEPENDENCY") return NextResponse.json({ error: "Circular dependencies are not allowed." }, { status: 409 });
    if (error instanceof Error && "code" in error && error.code === "COMPONENT_NOT_FOUND") return NextResponse.json({ error: "Both components must exist." }, { status: 400 });
    if (error instanceof Error && "errno" in error && error.errno === 1062) return NextResponse.json({ error: "This dependency already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the dependency." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasRole(session, ["Admin"])) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const parsed = dependencySchema.safeParse({ componentId: params.get("componentId"), dependsOnComponentId: params.get("dependsOnComponentId") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid dependency identifiers." }, { status: 400 });
  try {
    const result = await execute("DELETE FROM COMPONENT_DEPENDENCY WHERE ComponentID = ? AND DependsOnComponentID = ?", [parsed.data.componentId, parsed.data.dependsOnComponentId]);
    if (result.affectedRows) await invalidate(["dependencies"]);
    return result.affectedRows ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "Dependency not found." }, { status: 404 });
  } catch (error) {
    logDatabaseError("dependencies.delete", error);
    return NextResponse.json({ error: "Unable to delete the dependency." }, { status: 503 });
  }
}
