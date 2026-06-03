import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";
import { Errors } from "@/lib/errors";
import { createSiteSchema } from "@/lib/validations/site";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 20)),
  );
  const activeParam = searchParams.get("active");
  const search = searchParams.get("search")?.trim();

  const where = {
    deletedAt: null,
    ...(activeParam !== null && { active: activeParam === "true" }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [sites, total] = await Promise.all([
    prisma.site.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.site.count({ where }),
  ]);

  return NextResponse.json({
    data: sites,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;

  const roleError = requireRole(user, ["admin", "operator"]);
  if (roleError) return roleError;

  const body = await req.json().catch(() => null);
  const parsed = createSiteSchema.safeParse(body);
  if (!parsed.success) return Errors.validation(parsed.error.flatten());

  const { name } = parsed.data;

  const existing = await prisma.site.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
  });
  if (existing) return Errors.conflict(`El sitio "${name}" ya existe`);

  const site = await prisma.site.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "site_created",
      resourceType: "site",
      resourceId: site.id,
      metadata: { name: site.name },
    },
  });

  return NextResponse.json({ data: site }, { status: 201 });
}
