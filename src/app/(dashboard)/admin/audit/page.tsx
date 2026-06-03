"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  user_login: "bg-green-100 text-green-700",
  user_logout: "bg-gray-100 text-gray-600",
  user_created: "bg-blue-100 text-blue-700",
  user_updated: "bg-yellow-100 text-yellow-700",
  user_deleted: "bg-red-100 text-red-700",
  camera_created: "bg-blue-100 text-blue-700",
  camera_updated: "bg-yellow-100 text-yellow-700",
  camera_deleted: "bg-red-100 text-red-700",
  camera_viewed: "bg-gray-100 text-gray-600",
  layout_created: "bg-purple-100 text-purple-700",
  layout_updated: "bg-yellow-100 text-yellow-700",
  layout_deleted: "bg-red-100 text-red-700",
  layout_duplicated: "bg-purple-100 text-purple-700",
  site_created: "bg-blue-100 text-blue-700",
  site_updated: "bg-yellow-100 text-yellow-700",
  site_deleted: "bg-red-100 text-red-700",
  auth_failure: "bg-red-100 text-red-700",
  stream_access: "bg-green-100 text-green-700",
  system_event: "bg-gray-100 text-gray-600",
};

const AUDIT_ACTIONS = [
  "user_login", "user_logout", "user_created", "user_updated", "user_deleted",
  "camera_created", "camera_updated", "camera_deleted", "camera_viewed",
  "layout_created", "layout_updated", "layout_deleted", "layout_duplicated",
  "site_created", "site_updated", "site_deleted",
  "auth_failure", "stream_access", "system_event",
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterResource, setFilterResource] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filterAction) params.set("action", filterAction);
    if (filterResource) params.set("resourceType", filterResource);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);

    const res = await fetch(`/api/audit?${params}`).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setLogs(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
    }
    setLoading(false);
  }, [page, filterAction, filterResource, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function handleFilter() {
    setPage(1);
    fetchLogs();
  }

  function handleClearFilters() {
    setFilterAction("");
    setFilterResource("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auditoría</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de todas las acciones del sistema ({total.toLocaleString()} entradas)
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Acción</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Recurso</label>
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos</option>
              {["user", "camera", "layout", "site", "stream"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleFilter}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando registros…</p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No se encontraron registros.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Acción</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Usuario</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Recurso</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Metadata</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {log.user ? (
                        <div>
                          <p className="text-xs font-medium text-foreground">{log.user.name}</p>
                          <p className="text-[10px] text-muted-foreground">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sistema</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {log.resourceType && (
                        <div>
                          <span className="text-xs text-muted-foreground">{log.resourceType}</span>
                          {log.resourceId && (
                            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                              {log.resourceId.slice(0, 8)}…
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      {log.metadata != null && (
                        <code className="text-[10px] text-muted-foreground truncate max-w-[180px] block">
                          {(() => { const s = JSON.stringify(log.metadata); return s.length > 60 ? s.slice(0, 60) + "…" : s; })()}
                        </code>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("es-MX", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Página {page} de {totalPages} · {total.toLocaleString()} registros</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
