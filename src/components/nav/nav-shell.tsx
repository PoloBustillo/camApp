"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

interface NavShellProps {
  userName: string;
  userEmail: string;
  userRole: string;
  isAdmin: boolean;
  children: React.ReactNode;
}

const mainLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cameras", label: "Cámaras" },
  { href: "/cameras/discovery", label: "↳ Descubrir cámaras" },
  { href: "/layouts", label: "Layouts" },
  { href: "/sites", label: "Sitios" },
];

const adminLinks = [
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/audit", label: "Auditoría" },
];

export function NavShell({
  userName,
  userEmail,
  userRole,
  isAdmin,
  children,
}: NavShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const linkClass = (href: string) =>
    [
      "block px-2 py-1.5 rounded hover:bg-muted hover:text-foreground transition-colors",
      isActive(href) ? "bg-muted text-foreground font-medium" : "text-muted-foreground",
    ].join(" ");

  const NavLinks = () => (
    <>
      {mainLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={linkClass(href)}
          onClick={() => setDrawerOpen(false)}
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
              className={linkClass(href)}
              onClick={() => setDrawerOpen(false)}
            >
              {label}
            </Link>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="md:flex bg-background min-h-screen">
      {/* ── Mobile top header ── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-background border-b border-border h-14 flex items-center px-4 gap-3 md:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setDrawerOpen(true)}
          className="text-foreground p-1"
        >
          <span className="flex flex-col gap-1">
            <span className="block w-5 h-0.5 bg-current" />
            <span className="block w-5 h-0.5 bg-current" />
            <span className="block w-5 h-0.5 bg-current" />
          </span>
        </button>
        <span className="flex-1 text-sm font-semibold text-foreground text-center">
          CamWatch
        </span>
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </header>

      {/* ── Mobile slide-in drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            className={[
              "fixed left-0 top-0 h-full w-72 bg-background border-r border-border flex flex-col z-50",
              "transform transition-transform duration-300",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <span className="text-sm font-semibold text-foreground">CamWatch</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 text-sm">
              <NavLinks />
            </nav>
            <div className="border-t border-border px-4 py-4 space-y-1">
              <p className="text-xs text-muted-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <p className="text-[10px] text-muted-foreground/60 capitalize">{userRole}</p>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 border-r border-border p-4 flex-col min-h-screen">
        <div className="text-sm font-semibold text-foreground mb-4">CamWatch</div>
        <nav className="space-y-1 text-sm flex-1">
          <NavLinks />
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-1">
          <p className="text-xs text-muted-foreground truncate">{userName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          <p className="text-[10px] text-muted-foreground/60 capitalize">{userRole}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 p-6 min-h-screen pt-[3.5rem] pb-16 md:pt-6 md:pb-6">
        {children}
      </main>

      {/* ── Mobile bottom tab nav ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-background border-t border-border h-14 z-40 flex items-center md:hidden">
        <Link
          href="/dashboard"
          className={[
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2",
            isActive("/dashboard") ? "text-primary font-medium" : "text-muted-foreground",
          ].join(" ")}
        >
          <span className="text-lg leading-none">🏠</span>
          <span>Dashboard</span>
        </Link>
        <Link
          href="/cameras"
          className={[
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2",
            isActive("/cameras") ? "text-primary font-medium" : "text-muted-foreground",
          ].join(" ")}
        >
          <span className="text-lg leading-none">📷</span>
          <span>Cámaras</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2 text-muted-foreground"
          aria-label="Más opciones"
        >
          <span className="text-lg leading-none font-bold tracking-widest">···</span>
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
