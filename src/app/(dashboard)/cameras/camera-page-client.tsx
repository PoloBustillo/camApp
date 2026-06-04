"use client";

import { useState, useTransition } from "react";
import type { Camera, Site } from "@prisma/client";
import { CameraList } from "./camera-list";
import Link from "next/link";

type CameraWithSite = Camera & { site: { id: string; name: string } | null };

type MediaMtxServerWithCount = {
  id: string;
  name: string;
  baseUrl: string;
  apiUrl: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { cameras: number };
};

interface Props {
  cameras: CameraWithSite[];
  sites: Pick<Site, "id" | "name">[];
  servers: MediaMtxServerWithCount[];
}

type Tab = "servers" | "cameras";

type TestResult = {
  ok: boolean;
  latencyMs: number;
  streamCount?: number;
  error?: string;
};

export function CameraPageClient({ cameras, sites, servers: initialServers }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("servers");
  const [servers, setServers] = useState(initialServers);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loadingTest, setLoadingTest] = useState<Record<string, boolean>>({});
  const [loadingSync, setLoadingSync] = useState<Record<string, boolean>>({});
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<MediaMtxServerWithCount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputCls =
    "w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  async function handleTest(serverId: string) {
    setLoadingTest((prev) => ({ ...prev, [serverId]: true }));
    try {
      const res = await fetch(`/api/mediamtx-servers/${serverId}/test`, {
        method: "POST",
      });
      const json = await res.json();
      setTestResults((prev) => ({ ...prev, [serverId]: json.data }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [serverId]: { ok: false, latencyMs: 0, error: "Request failed" },
      }));
    } finally {
      setLoadingTest((prev) => ({ ...prev, [serverId]: false }));
    }
  }

  async function handleSync(serverId: string) {
    setLoadingSync((prev) => ({ ...prev, [serverId]: true }));
    setSyncResults((prev) => ({ ...prev, [serverId]: "" }));
    try {
      const res = await fetch(`/api/mediamtx-servers/${serverId}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        const { synced, online, offline } = json.data;
        setSyncResults((prev) => ({
          ...prev,
          [serverId]: `Sync: ${synced} actualiz. | ${online} online | ${offline} offline`,
        }));
      } else {
        setSyncResults((prev) => ({
          ...prev,
          [serverId]: json.error?.message ?? "Error",
        }));
      }
    } catch {
      setSyncResults((prev) => ({ ...prev, [serverId]: "Request failed" }));
    } finally {
      setLoadingSync((prev) => ({ ...prev, [serverId]: false }));
    }
  }

  async function handleDelete(server: MediaMtxServerWithCount) {
    if (!confirm(`¿Eliminar el servidor "${server.name}"?`)) return;
    const res = await fetch(`/api/mediamtx-servers/${server.id}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) {
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } else {
      const json = await res.json().catch(() => null);
      alert(json?.error?.message ?? "Error al eliminar");
    }
  }

  function openCreate() {
    setEditTarget(null);
    setShowForm(true);
    setFormError(null);
  }

  function openEdit(server: MediaMtxServerWithCount) {
    setEditTarget(server);
    setShowForm(true);
    setFormError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"),
      baseUrl: fd.get("baseUrl"),
      apiUrl: fd.get("apiUrl"),
      description: fd.get("description") || undefined,
      enabled: fd.get("enabled") === "true",
    };

    setFormError(null);
    startTransition(async () => {
      const url = editTarget
        ? `/api/mediamtx-servers/${editTarget.id}`
        : "/api/mediamtx-servers";
      const method = editTarget ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (res.ok) {
        window.location.reload();
      } else {
        setFormError(json?.error?.message ?? "Error al guardar");
      }
    });
  }

  const tabCls = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button className={tabCls("servers")} onClick={() => setActiveTab("servers")}>
          Servidores MediaMTX{" "}
          <span className="ml-1 text-xs bg-muted rounded-full px-1.5 py-0.5">{servers.length}</span>
        </button>
        <button className={tabCls("cameras")} onClick={() => setActiveTab("cameras")}>
          Cámaras{" "}
          <span className="ml-1 text-xs bg-muted rounded-full px-1.5 py-0.5">{cameras.length}</span>
        </button>
      </div>

      {/* ─── Servers tab ─── */}
      {activeTab === "servers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {servers.length} servidor{servers.length !== 1 ? "es" : ""} registrado{servers.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <Link
                href="/cameras/discovery"
                className="px-4 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors"
              >
                🔍 Descubrir cámaras
              </Link>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                + Nuevo servidor
              </button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
              <p className="text-lg">No hay servidores MediaMTX registrados</p>
              <p className="text-sm mt-1">Agrega un servidor para empezar a descubrir cámaras</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="border border-border rounded-lg p-4 bg-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{server.name}</h3>
                      {server.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {server.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        server.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {server.enabled ? "Habilitado" : "Deshabilitado"}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 font-mono">
                    <div className="truncate">
                      <span className="text-foreground font-sans font-medium">Base: </span>
                      {server.baseUrl}
                    </div>
                    <div className="truncate">
                      <span className="text-foreground font-sans font-medium">API: </span>
                      {server.apiUrl}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{server._count.cameras}</span>{" "}
                    cámara{server._count.cameras !== 1 ? "s" : ""}
                  </div>

                  {/* Test result */}
                  {testResults[server.id] && (
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        testResults[server.id].ok
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {testResults[server.id].ok ? (
                        <>
                          ✓ Conectado — {testResults[server.id].latencyMs}ms —{" "}
                          {testResults[server.id].streamCount ?? 0} streams
                        </>
                      ) : (
                        <>✗ {testResults[server.id].error}</>
                      )}
                    </div>
                  )}

                  {/* Sync result */}
                  {syncResults[server.id] && (
                    <div className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                      {syncResults[server.id]}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleTest(server.id)}
                      disabled={loadingTest[server.id]}
                      className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      {loadingTest[server.id] ? "Probando…" : "Test"}
                    </button>
                    <Link
                      href={`/cameras/discovery?serverId=${server.id}`}
                      className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted transition-colors"
                    >
                      Paths
                    </Link>
                    <button
                      onClick={() => handleSync(server.id)}
                      disabled={loadingSync[server.id]}
                      className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      {loadingSync[server.id] ? "Sincronizando…" : "Sync"}
                    </button>
                    <button
                      onClick={() => openEdit(server)}
                      className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(server)}
                      className="px-2.5 py-1 text-xs text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Cameras tab ─── */}
      {activeTab === "cameras" && <CameraList cameras={cameras} sites={sites} />}

      {/* ─── Server form modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editTarget ? `Editar: ${editTarget.name}` : "Nuevo servidor MediaMTX"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <input
                  name="name"
                  required
                  defaultValue={editTarget?.name ?? ""}
                  className={inputCls}
                  placeholder="Mi servidor MediaMTX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  URL Base <span className="text-destructive">*</span>
                </label>
                <input
                  name="baseUrl"
                  required
                  type="url"
                  defaultValue={editTarget?.baseUrl ?? ""}
                  className={inputCls}
                  placeholder="http://192.168.1.100:8554"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  URL API <span className="text-destructive">*</span>
                </label>
                <input
                  name="apiUrl"
                  required
                  type="url"
                  defaultValue={editTarget?.apiUrl ?? ""}
                  className={inputCls}
                  placeholder="http://192.168.1.100:9997"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editTarget?.description ?? ""}
                  className={`${inputCls} resize-none`}
                  placeholder="Descripción opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  name="enabled"
                  defaultValue={String(editTarget?.enabled ?? true)}
                  className={inputCls}
                >
                  <option value="true">Habilitado</option>
                  <option value="false">Deshabilitado</option>
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Guardando..." : editTarget ? "Actualizar" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
