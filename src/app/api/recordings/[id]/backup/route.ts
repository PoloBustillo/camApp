import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/middleware";
import { backupRecording } from "@/lib/backup-worker";
import { isCloudConfigured } from "@/lib/cloud/r2-client";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
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

  const { id } = await params;
  const result = await backupRecording(id);

  return NextResponse.json({ data: result });
}
