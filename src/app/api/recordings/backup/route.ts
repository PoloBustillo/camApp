import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/middleware";
import { backupRecording } from "@/lib/backup-worker";
import { isCloudConfigured } from "@/lib/cloud/r2-client";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  if (!isCloudConfigured()) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Cloud backup no configurado" } },
      { status: 500 },
    );
  }

  let body: { recordingIds?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body = backup all pending
  }

  const { recordingIds } = body;

  if (recordingIds && recordingIds.length > 0) {
    const results = await Promise.all(
      recordingIds.map(async (id) => {
        const result = await backupRecording(id);
        return { id, ...result };
      }),
    );
    return NextResponse.json({ data: results });
  }

  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message: "Se requiere recordingIds" } },
    { status: 400 },
  );
}
