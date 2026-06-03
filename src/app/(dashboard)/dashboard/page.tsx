import { requireSession } from "@/lib/session"

export default async function DashboardPage() {
  const session = await requireSession()
  const user = session.user

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
      <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
        <p className="text-muted-foreground">
          Bienvenido, <span className="text-foreground font-medium">{user.name ?? ""}</span>
        </p>
        <p className="text-muted-foreground">
          Rol: <span className="text-foreground font-medium capitalize">{user.role}</span>
        </p>
      </div>
      <p className="text-muted-foreground text-sm">
        Vista de monitoreo — Sprint 2
      </p>
    </div>
  )
}
