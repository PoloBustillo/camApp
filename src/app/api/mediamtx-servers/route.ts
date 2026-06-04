import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createMediaMtxServerSchema } from "@/lib/validations/mediamtx-server";

export async function GET(_req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const servers = await prisma.mediaMtxServer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { cameras: true } } },
  });

  return NextResponse.json({ data: servers });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createMediaMtxServerSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const server = await prisma.mediaMtxServer.create({ data: parsed.data });

  return NextResponse.json({ data: server }, { status: 201 });
}
