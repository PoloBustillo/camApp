import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin"]);
  if (roleError) return roleError;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 25)));

  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const resourceType = searchParams.get("resourceType");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (resourceType) where.resourceType = resourceType;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
