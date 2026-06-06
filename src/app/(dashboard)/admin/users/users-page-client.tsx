"use client";

import { useEffect, useState, useTransition } from "react";

type UserRole = "admin" | "operator" | "viewer";
type UserStatus = "active" | "inactive" | "locked";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operador",
  viewer: "Visualizador",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  locked: "Bloqueado",
};

const STATUS_CLASSES: Record<UserStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  locked: "bg-red-100 text-red-600",
};

const inputCls =
  "w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const labelCls = "block text-sm font-medium mb-1";

type FormMode = "create" | "edit";

interface FormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}

function emptyForm(): FormData {
  return { name: "", email: "", password: "", role: "viewer", status: "active" };
}

export function UsersPageClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<FormMode>("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        if (res.status === 403) throw new Error("No tienes permisos de administrador");
        throw new Error("Error al cargar usuarios");
      }
      const json = await res.json();
      setUsers(json.data as User[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setMode("create");
    setEditId(null);
    setForm(emptyForm());
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(user: User) {
    setMode("edit");
    setEditId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
  }

  function handleField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        if (mode === "create") {
          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            setFormError(json?.error?.message ?? "Error al crear usuario");
            return;
          }
        } else {
          const body: Record<string, unknown> = {
            name: form.name,
            email: form.email,
            role: form.role,
            status: form.status,
          };
          const res = await fetch(`/api/users/${editId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            setFormError(json?.error?.message ?? "Error al actualizar usuario");
            return;
          }
        }
        closeModal();
        fetchUsers();
      } catch {
        setFormError("Error de red");
      }
    });
  }

  async function handleDelete(user: User) {
    if (!confirm(`¿Eliminar al usuario "${user.name}"?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null);
        alert(json?.error?.message ?? "Error al eliminar");
        return;
      }
      fetchUsers();
    } catch {
      alert("Error de red");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      )}

      {error && !loading && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <p className="text-lg">No hay usuarios registrados</p>
          <p className="text-sm mt-1">Crea el primer usuario para empezar</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Último acceso</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[user.status]}`}>
                      {STATUS_LABELS[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString("es-MX")
                      : "Nunca"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="px-2.5 py-1 text-xs border border-border rounded hover:bg-muted transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="px-2.5 py-1 text-xs text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>
                  Nombre <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => handleField("name", e.target.value)}
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className={labelCls}>
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => handleField("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className={labelCls}>
                  {mode === "create" ? "Contraseña" : "Nueva contraseña (dejar vacío para mantener)"}
                  {mode === "create" && <span className="text-destructive"> *</span>}
                </label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.password}
                  onChange={(e) => handleField("password", e.target.value)}
                  placeholder={mode === "create" ? "Mínimo 8 caracteres" : "Dejar vacío para mantener"}
                  required={mode === "create"}
                  minLength={mode === "create" ? 8 : undefined}
                />
              </div>

              <div>
                <label className={labelCls}>Rol</label>
                <select
                  className={inputCls}
                  value={form.role}
                  onChange={(e) => handleField("role", e.target.value as UserRole)}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>

              {mode === "edit" && (
                <div>
                  <label className={labelCls}>Estado</label>
                  <select
                    className={inputCls}
                    value={form.status}
                    onChange={(e) => handleField("status", e.target.value as UserStatus)}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="locked">Bloqueado</option>
                  </select>
                </div>
              )}

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
                  {isPending
                    ? "Guardando..."
                    : mode === "create"
                      ? "Crear usuario"
                      : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
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
