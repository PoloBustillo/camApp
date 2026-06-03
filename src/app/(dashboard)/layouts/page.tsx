"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore, type LayoutConfiguration } from "@/stores/dashboard.store";
import { SaveLayoutModal } from "@/components/layouts/save-layout-modal";

interface LayoutRow {
  id: string;
  name: string;
  configuration: LayoutConfiguration | null;
  isDefault: boolean;
  isShared: boolean;
  ownerId: string;
  owner: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export default function LayoutsPage() {
  const router = useRouter();
  const loadConfiguration = useDashboardStore((s) => s.loadConfiguration);

  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchLayouts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/layouts?limit=50").catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setLayouts(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLayouts(); }, [fetchLayouts]);

  async function handleApply(layout: LayoutRow) {
    if (!layout.configuration) return;
    loadConfiguration(layout.configuration);
    router.push("/dashboard");
  }

  async function handleDuplicate(layout: LayoutRow) {
    const newName = window.prompt("Nombre para la copia:", `${layout.name} (copia)`);
    if (!newName?.trim()) return;
    setDuplicating(layout.id);

    const res = await fetch(`/api/layouts/${layout.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    setDuplicating(null);
    if (res.ok) await fetchLayouts();
  }

  async function handleDelete(layout: LayoutRow) {
    if (!window.confirm(`¿Eliminar "${layout.name}"?`)) return;
    setDeleting(layout.id);

    await fetch(`/api/layouts/${layout.id}`, { method: "DELETE" });
    setDeleting(null);
    setLayouts((prev) => prev.filter((l) => l.id !== layout.id));
  }

  async function handleSetDefault(layout: LayoutRow) {
    await fetch(`/api/layouts/${layout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await fetchLayouts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Layouts guardados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guarda y carga configuraciones del dashboard
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <span>+</span> Guardar actual
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando layouts…</div>
      ) : layouts.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            No hay layouts guardados. Configura el dashboard y guárdalo.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Grid</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Creado por</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Actualizado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {layouts.map((layout) => (
                <tr key={layout.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {layout.name}
                      </span>
                      {layout.isDefault && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          Default
                        </span>
                      )}
                      {layout.isShared && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          Compartido
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground font-mono">
                    {layout.configuration?.gridLayout ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[150px]">
                    {layout.owner.name}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {new Date(layout.updatedAt).toLocaleDateString("es-MX", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {layout.configuration && (
                        <button
                          type="button"
                          onClick={() => handleApply(layout)}
                          title="Aplicar al dashboard"
                          className="px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                        >
                          Aplicar
                        </button>
                      )}
                      {!layout.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(layout)}
                          title="Marcar como predeterminado"
                          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          ★
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDuplicate(layout)}
                        disabled={duplicating === layout.id}
                        title="Duplicar layout"
                        className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(layout)}
                        disabled={deleting === layout.id}
                        title="Eliminar"
                        className="px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSaveModal && (
        <SaveLayoutModal
          onClose={() => setShowSaveModal(false)}
          onSaved={() => fetchLayouts()}
        />
      )}
    </div>
  );
}

