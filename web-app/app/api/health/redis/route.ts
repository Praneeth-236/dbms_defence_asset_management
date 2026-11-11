import { NextResponse } from "next/server";
import { listCacheEntries } from "../../../../lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await listCacheEntries();
  return NextResponse.json(
    {
      service: "redis-cache",
      ...status
    },
    { status: status.reachable ? 200 : 503 }
  );
}
