import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AdminRolesPage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");

  const [adminCount, operatorCount, viewerCount, recentAdmins, recentOperators, recentViewers] =
    await Promise.all([
      prisma.user.count({ where: { role: "admin", deletedAt: null } }),
      prisma.user.count({ where: { role: "operator", deletedAt: null } }),
      prisma.user.count({ where: { role: "viewer", deletedAt: null } }),
      prisma.user.findMany({
        where: { role: "admin", deletedAt: null },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "operator", deletedAt: null },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "viewer", deletedAt: null },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const roles = [
    {
      name: "Admin",
      value: "admin",
      count: adminCount,
      users: recentAdmins,
      description: "Acceso total: gestión de usuarios, cámaras, sitios y configuración del sistema.",
      color: "text-red-600 bg-red-50 border-red-200",
      badge: "bg-red-100 text-red-700",
    },
    {
      name: "Operator",
      value: "operator",
      count: operatorCount,
      users: recentOperators,
      description: "Puede crear y editar cámaras y sitios. No puede gestionar usuarios.",
      color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      badge: "bg-yellow-100 text-yellow-700",
    },
    {
      name: "Viewer",
      value: "viewer",
      count: viewerCount,
      users: recentViewers,
      description: "Solo lectura: visualizar cámaras y dashboard. Sin modificaciones.",
      color: "text-blue-600 bg-blue-50 border-blue-200",
      badge: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roles y Permisos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen de roles del sistema y usuarios asignados
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role.value} className={`rounded-lg border p-4 ${role.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{role.name}</span>
              <span className={`text-lg font-bold px-2 py-0.5 rounded-md ${role.badge}`}>
                {role.count}
              </span>
            </div>
            <p className="text-xs opacity-80">{role.description}</p>
          </div>
        ))}
      </div>

      {/* Users per role */}
      <div className="space-y-6">
        {roles.map((role) => (
          <div key={role.value} className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{role.name}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${role.badge}`}>
                {role.count}
              </span>
            </div>
            {role.users.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin usuarios con este rol.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {role.users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          u.status === "active" ? "bg-green-100 text-green-700" :
                          u.status === "locked" ? "bg-red-100 text-red-600" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* Permissions matrix */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2">
          <span className="font-semibold text-sm text-foreground">Matriz de permisos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-2">Acción</th>
                <th className="text-center px-4 py-2">Admin</th>
                <th className="text-center px-4 py-2">Operator</th>
                <th className="text-center px-4 py-2">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Ver dashboard y cámaras", true, true, true],
                ["Crear / editar cámaras", true, true, false],
                ["Eliminar cámaras", true, false, false],
                ["Gestionar sitios", true, true, false],
                ["Gestionar layouts", true, true, true],
                ["Ver auditoría", true, false, false],
                ["Gestionar usuarios", true, false, false],
                ["Configuración del sistema", true, false, false],
              ].map(([label, a, o, v]) => (
                <tr key={String(label)} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 text-foreground">{label}</td>
                  <td className="px-4 py-2 text-center">{a ? "✅" : "❌"}</td>
                  <td className="px-4 py-2 text-center">{o ? "✅" : "❌"}</td>
                  <td className="px-4 py-2 text-center">{v ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
