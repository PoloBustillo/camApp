import type { Metadata } from "next"
import Link from "next/link"
import { requireSession } from "@/lib/session"
import { LogoutButton } from "@/components/auth/logout-button"

export const metadata: Metadata = {
  title: "Dashboard — CamWatch",
}

const mainLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cameras", label: "Cámaras" },
  { href: "/layouts", label: "Layouts" },
  { href: "/sites", label: "Sitios" },
]

const adminLinks = [
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/audit", label: "Auditoría" },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()
  const user = session.user
  const isAdmin = user.role === "admin"

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border p-4 flex flex-col">
        <div className="text-sm font-semibold text-foreground mb-4">
          CamWatch
        </div>
        <nav className="space-y-1 text-sm text-muted-foreground flex-1">
          {mainLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-2 py-1.5 rounded hover:bg-muted hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="pt-3 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Administración
              </div>
              {adminLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block px-2 py-1.5 rounded hover:bg-muted hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-1">
          <p className="text-xs text-muted-foreground truncate">{user.name ?? ""}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <p className="text-[10px] text-muted-foreground/60 capitalize">{user.role}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}

