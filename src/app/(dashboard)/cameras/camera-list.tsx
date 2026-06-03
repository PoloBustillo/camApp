"use client";

import { useState, useTransition, useMemo } from "react";
import type { Camera, Site } from "@prisma/client";
import { createCameraAction, updateCameraAction, deleteCameraAction } from "./actions";

type CameraWithSite = Camera & { site: { id: string; name: string } };

const PROTOCOLS = ["rtsp", "rtmp", "webrtc", "hls"] as const;

interface Props {
  cameras: CameraWithSite[];
  sites: Pick<Site, "id" | "name">[];
}

export function CameraList({ cameras: initialCameras, sites }: Props) {
  const [cameras, setCameras] = useState(initialCameras);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CameraWithSite | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterSite, setFilterSite] = useState("");
  const [filterProtocol, setFilterProtocol] = useState("");
  const [filterEnabled, setFilterEnabled] = useState("");
  const [filterOnline, setFilterOnline] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return cameras.filter((c) => {
      if (filterSite && c.siteId !== filterSite) return false;
      if (filterProtocol && c.protocol !== filterProtocol) return false;
      if (filterEnabled !== "" && String(c.enabled) !== filterEnabled) return false;
      if (filterOnline !== "" && String(c.online) !== filterOnline) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [cameras, filterSite, filterProtocol, filterEnabled, filterOnline, search]);

  function openCreate() { setEditTarget(null); setShowForm(true); setError(null); }
  function openEdit(c: CameraWithSite) { setEditTarget(c); setShowForm(true); setError(null); }
  function closeForm() { setShowForm(false); setEditTarget(null); setError(null); }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la cámara "${name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCameraAction(id);
      if (result.success) {
        setCameras((prev) => prev.filter((c) => c.id !== id));
      } else {
        setError(result.error);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = editTarget
        ? await updateCameraAction(editTarget.id, formData)
        : await createCameraAction(formData);
      if (result.success) { window.location.reload(); }
      else { setError(result.error); }
    });
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring";
  const selectCls = `${inputCls} cursor-pointer`;

  return (
    <div className="space-y-4">
      {/* ─── Filters bar ─── */}
      <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-lg p-3 border border-border">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background cursor-pointer">
          <option value="">Todos los sitios</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterProtocol} onChange={(e) => setFilterProtocol(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background cursor-pointer">
          <option value="">Todos los protocolos</option>
          {PROTOCOLS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
        <select value={filterEnabled} onChange={(e) => setFilterEnabled(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background cursor-pointer">
          <option value="">Habilitadas/Deshabilitadas</option>
          <option value="true">Habilitadas</option>
          <option value="false">Deshabilitadas</option>
        </select>
        <select value={filterOnline} onChange={(e) => setFilterOnline(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background cursor-pointer">
          <option value="">Online/Offline</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        {(search || filterSite || filterProtocol || filterEnabled || filterOnline) && (
          <button onClick={() => { setSearch(""); setFilterSite(""); setFilterProtocol(""); setFilterEnabled(""); setFilterOnline(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline">
            Limpiar filtros
          </button>
        )}
        <div className="ml-auto">
          <button onClick={openCreate} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
            + Nueva cámara
          </button>
        </div>
      </div>

      {/* ─── Results count ─── */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} de {cameras.length} cámara{cameras.length !== 1 ? "s" : ""}
      </p>

      {/* ─── Error banner ─── */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>
      )}

      {/* ─── Modal form ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editTarget ? `Editar: ${editTarget.name}` : "Nueva cámara"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sitio <span className="text-destructive">*</span>
                </label>
                <select name="siteId" required defaultValue={editTarget?.siteId ?? ""} className={selectCls}>
                  <option value="" disabled>Selecciona un sitio...</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <input name="name" required defaultValue={editTarget?.name ?? ""} className={inputCls} placeholder="Ej: Cámara Entrada Principal" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea name="description" rows={2} defaultValue={editTarget?.description ?? ""} className={`${inputCls} resize-none`} placeholder="Descripción opcional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Path / URL <span className="text-destructive">{editTarget ? "" : "*"}</span>
                  <span className="text-xs text-muted-foreground font-normal ml-1">(se almacena cifrado)</span>
                </label>
                <input
                  name="path"
                  required={!editTarget}
                  type="text"
                  className={inputCls}
                  placeholder="rtsp://user:pass@192.168.1.100:554/stream"
                />
                {editTarget && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dejar vacío para mantener el path actual.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Protocolo</label>
                <select name="protocol" defaultValue={editTarget?.protocol ?? "rtsp"} className={selectCls}>
                  {PROTOCOLS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="enabled" id="cam-enabled" value="true" defaultChecked={editTarget?.enabled ?? true} className="rounded" />
                <label htmlFor="cam-enabled" className="text-sm">Habilitada</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {isPending ? "Guardando..." : editTarget ? "Actualizar" : "Crear"}
                </button>
                <button type="button" onClick={closeForm} className="flex-1 px-4 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Table ─── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{cameras.length === 0 ? "No hay cámaras registradas" : "No hay resultados para los filtros aplicados"}</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sitio</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Protocolo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Online</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((camera, i) => (
                <tr key={camera.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{camera.name}</div>
                    {camera.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{camera.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{camera.site.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground">
                      {camera.protocol.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${camera.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {camera.enabled ? "Habilitada" : "Deshabilitada"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${camera.online ? "text-green-600" : "text-red-500"}`}>
                      <span className={`w-2 h-2 rounded-full ${camera.online ? "bg-green-500" : "bg-red-400"}`} />
                      {camera.online ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(camera)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(camera.id, camera.name)} disabled={isPending} className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
