"use client";

import { useEffect, useState, useCallback } from "react";

type UserRole = "admin" | "operator" | "viewer";
type UserStatus = "active" | "inactive" | "locked";

interface UserRow {
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
  operator: "Operator",
  viewer: "Viewer",
};

const STATUS_COLORS: Record<UserStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  locked: "bg-red-100 text-red-600",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users?limit=100").catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setUsers(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleDelete(u: UserRow) {
    if (!window.confirm(`¿Eliminar a "${u.name}"? Esta acción es irreversible.`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  async function handleToggleStatus(u: UserRow) {
    const next: UserStatus = u.status === "active" ? "inactive" : "active";
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await fetchUsers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de cuentas y roles ({users.length} usuarios)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Último login</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={u.status === "active" ? "Desactivar" : "Activar"}
                      >
                        {u.status === "active" ? "🔒" : "✓"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        className="px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
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

      {(showCreate || editUser) && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowCreate(false); setEditUser(null); }}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
}

// ─── UserFormModal ────────────────────────────────────────────────────────────

interface UserFormModalProps {
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ user, onClose, onSaved }: UserFormModalProps) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "viewer");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !email.trim()) { setError("Nombre y email son requeridos"); return; }
    if (!isEdit && password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }

    setLoading(true);

    const body: Record<string, unknown> = { name: name.trim(), email: email.trim(), role };
    if (!isEdit) body.password = password;
    else if (password) body.password = password;

    const url = isEdit ? `/api/users/${user.id}` : "/api/users";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Error al guardar");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "••••••••" : "Mínimo 8 caracteres"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-3 py-2 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}
