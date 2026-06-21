import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { syncCameraStatus } from "@/lib/sync-cameras";

/**
 * POST /api/edge-servers/sync-all
 * Syncs camera online status from all streaming servers.
 * Called by the health widget and dashboard on load.
 */
export async function POST() {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  await syncCameraStatus();

  return NextResponse.json({ ok: true });
}
