import type { Metadata } from "next"
import { requireSession } from "@/lib/session"
import { LogoutButton } from "@/components/auth/logout-button"

export const metadata: Metadata = {
  title: "Dashboard — CamWatch",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()
  const user = session.user

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border p-4 flex flex-col">
        <div className="text-sm font-semibold text-foreground mb-4">
          CamWatch
        </div>
        <nav className="space-y-1 text-sm text-muted-foreground flex-1">
          <div>Dashboard</div>
          <div>Cámaras</div>
          <div>Layouts</div>
          <div>Usuarios</div>
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-1">
          <p className="text-xs text-muted-foreground truncate">{user.name ?? ""}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
