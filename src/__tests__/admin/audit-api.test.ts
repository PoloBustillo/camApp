import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/middleware", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  Errors: {
    forbidden: vi.fn(() => new Response(null, { status: 403 })),
    unauthorized: vi.fn(() => new Response(null, { status: 401 })),
  },
}));

import { GET } from "@/app/api/audit/route";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";

// ── Helpers ────────────────────────────────────────────────────────────────

const adminUser = { id: "admin-id", email: "admin@test.com", role: "admin" };

const mockLog = {
  id: "log-1",
  action: "user_login",
  resourceType: "auth",
  resourceId: "user-id",
  metadata: { ip: "127.0.0.1" },
  ipAddress: "127.0.0.1",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  user: { id: "user-id", name: "Alice", email: "alice@test.com", role: "viewer" },
};

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/audit");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(requireRole).mockReturnValue(null);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockLog] as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
  });

  it("returns paginated audit logs for admin", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].action).toBe("user_login");
    expect(body.pagination).toMatchObject({ page: 1, limit: 25, total: 1, totalPages: 1 });
  });

  it("respects page and limit query params", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(50);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

    const res = await GET(makeRequest({ page: "2", limit: "10" }));
    const body = await res.json();

    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("clamps limit to max 100", async () => {
    await GET(makeRequest({ limit: "999" }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("filters by action", async () => {
    await GET(makeRequest({ action: "user_login" }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: "user_login" }) }),
    );
  });

  it("filters by userId", async () => {
    await GET(makeRequest({ userId: "user-abc" }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-abc" }) }),
    );
  });

  it("filters by resourceType", async () => {
    await GET(makeRequest({ resourceType: "camera" }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ resourceType: "camera" }) }),
    );
  });

  it("filters by dateFrom and dateTo", async () => {
    await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-01-31" }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2024-01-01"),
            lte: new Date("2024-01-31T23:59:59Z"),
          },
        }),
      }),
    );
  });

  it("rejects non-admin users", async () => {
    vi.mocked(requireRole).mockReturnValue(new Response(null, { status: 403 }) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns empty data array when no logs match", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    const res = await GET(makeRequest({ action: "nonexistent" }));
    const body = await res.json();

    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
  });

  it("orders results by createdAt desc", async () => {
    await GET(makeRequest());
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("selects user name and email in response", async () => {
    await GET(makeRequest());
    const call = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0];
    expect(call.select).toMatchObject({
      user: { select: { id: true, name: true, email: true, role: true } },
    });
  });
});
