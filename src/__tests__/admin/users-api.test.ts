import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/middleware", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  Errors: {
    validation: vi.fn((e) => new Response(JSON.stringify({ error: e }), { status: 400 })),
    notFound: vi.fn((n) => new Response(JSON.stringify({ error: `${n} not found` }), { status: 404 })),
    conflict: vi.fn((m) => new Response(JSON.stringify({ error: m }), { status: 409 })),
    forbidden: vi.fn((m) => new Response(JSON.stringify({ error: m ?? "Forbidden" }), { status: 403 })),
    unauthorized: vi.fn(() => new Response(null, { status: 401 })),
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("$2a$12$hashed") },
}));

import { GET as listUsers, POST as createUser } from "@/app/api/users/route";
import { GET as getUser, PATCH as updateUser, DELETE as deleteUser } from "@/app/api/users/[id]/route";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/middleware";

// ── Helpers ────────────────────────────────────────────────────────────────

const adminUser = { id: "admin-id", email: "admin@test.com", role: "admin" };
const operatorUser = { id: "op-id", email: "op@test.com", role: "operator" };

const mockUser = {
  id: "user-1",
  name: "Alice Smith",
  email: "alice@test.com",
  role: "viewer",
  status: "active",
  lastLoginAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function makeRequest(body?: unknown) {
  if (body) {
    return new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new NextRequest("http://localhost/api/users");
}

function makeIdRequest(method = "GET", body?: unknown) {
  if (body) {
    return new NextRequest("http://localhost/api/users/user-1", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new NextRequest("http://localhost/api/users/user-1", { method });
}

function makeParams(id = "user-1") {
  return { params: Promise.resolve({ id }) };
}

// ── GET /api/users ─────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(requireRole).mockReturnValue(null);
    vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
  });

  it("returns paginated user list for admin", async () => {
    const res = await listUsers(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].email).toBe("alice@test.com");
    expect(body.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it("rejects non-admin users", async () => {
    vi.mocked(requireRole).mockReturnValue(new Response(null, { status: 403 }) as any);

    const res = await listUsers(makeRequest());
    expect(res.status).toBe(403);
  });

  it("excludes password from response", async () => {
    const res = await listUsers(makeRequest());
    const body = await res.json();

    body.data.forEach((u: Record<string, unknown>) => {
      expect(u.passwordHash).toBeUndefined();
    });
  });
});

// ── POST /api/users ────────────────────────────────────────────────────────

describe("POST /api/users", () => {
  const validPayload = {
    name: "Bob Jones",
    email: "bob@test.com",
    password: "Password123!",
    role: "operator",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(requireRole).mockReturnValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ ...mockUser, ...validPayload } as any);
  });

  it("creates user with valid payload", async () => {
    const res = await createUser(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "user_created" }) }),
    );
    expect(body.data).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const res = await createUser(makeRequest(validPayload));
    expect(res.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects missing required fields", async () => {
    const res = await createUser(makeRequest({ name: "No email" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid role", async () => {
    const res = await createUser(makeRequest({ ...validPayload, role: "superadmin" }));
    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await createUser(makeRequest({ ...validPayload, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("hashes password before storing", async () => {
    await createUser(makeRequest(validPayload));
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: "$2a$12$hashed" }),
      }),
    );
  });
});

// ── GET /api/users/[id] ────────────────────────────────────────────────────

describe("GET /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
  });

  it("returns user by id for admin", async () => {
    const res = await getUser(makeIdRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("user-1");
  });

  it("allows user to view own profile", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ ...operatorUser, id: "user-1" } as any);

    const res = await getUser(makeIdRequest(), makeParams("user-1"));
    expect(res.status).toBe(200);
  });

  it("prevents operator from viewing another user's profile", async () => {
    vi.mocked(requireAuth).mockResolvedValue(operatorUser as any);

    const res = await getUser(makeIdRequest(), makeParams("other-id"));
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await getUser(makeIdRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/users/[id] ──────────────────────────────────────────────────

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(requireRole).mockReturnValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
  });

  it("updates user for admin", async () => {
    const res = await updateUser(makeIdRequest("PATCH", { role: "operator" }), makeParams());
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "user_updated" }) }),
    );
  });

  it("returns 404 for non-existent user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await updateUser(makeIdRequest("PATCH", { role: "admin" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("rejects invalid status value", async () => {
    const res = await updateUser(makeIdRequest("PATCH", { status: "unknown" }), makeParams());
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/users/[id] ─────────────────────────────────────────────────

describe("DELETE /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(adminUser as any);
    vi.mocked(requireRole).mockReturnValue(null);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
  });

  it("soft-deletes user (204)", async () => {
    const res = await deleteUser(makeIdRequest("DELETE"), makeParams());
    expect(res.status).toBe(204);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date), status: "inactive" }),
      }),
    );
  });

  it("prevents admin from deleting own account", async () => {
    const res = await deleteUser(makeIdRequest("DELETE"), makeParams("admin-id"));
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 for non-existent user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await deleteUser(makeIdRequest("DELETE"), makeParams());
    expect(res.status).toBe(404);
  });

  it("logs user_deleted audit event", async () => {
    await deleteUser(makeIdRequest("DELETE"), makeParams());
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "user_deleted" }) }),
    );
  });
});
