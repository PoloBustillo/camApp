"use client";

import { useState, useTransition } from "react";
import type { Site } from "@prisma/client";
import {
  createSiteAction,
  updateSiteAction,
  deleteSiteAction,
} from "./actions";

interface SiteListProps {
  sites: Site[];
}

export function SiteList({ sites: initialSites }: SiteListProps) {
  const [sites, setSites] = useState(initialSites);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(site: Site) {
    setEditTarget(site);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    setError(null);
  }

  function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Eliminar el sitio "${name}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteSiteAction(id);
      if (result.success) {
        setSites((prev) => prev.filter((s) => s.id !== id));
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
        ? await updateSiteAction(editTarget.id, formData)
        : await createSiteAction(formData);

      if (result.success) {
        // Refresh — the page will revalidate but since we're client we reload for simplicity
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {/* Header actions */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          + Nuevo sitio
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Site form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              {editTarget ? "Editar sitio" : "Nuevo sitio"}
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
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ej: Edificio Principal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editTarget?.description ?? ""}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Descripción opcional del sitio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Zona horaria
                </label>
                <input
                  name="timezone"
                  defaultValue={editTarget?.timezone ?? "UTC"}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="UTC, America/Mexico_City, etc."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  id="active"
                  value="true"
                  defaultChecked={editTarget?.active ?? true}
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm">
                  Activo
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending
                    ? "Guardando..."
                    : editTarget
                      ? "Actualizar"
                      : "Crear"}
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

      {/* Sites table */}
      {sites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No hay sitios registrados</p>
          <p className="text-sm mt-1">Crea el primer sitio para comenzar</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Descripción
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Zona horaria
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site, i) => (
                <tr
                  key={site.id}
                  className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className="px-4 py-3 font-medium">{site.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {site.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {site.timezone}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        site.active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {site.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(site)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(site.id, site.name)}
                      disabled={isPending}
                      className="text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 transition-colors"
                    >
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
