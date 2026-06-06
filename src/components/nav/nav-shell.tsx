"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Home, Satellite, Star, Tv, Shield, Menu, X, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface NavShellProps {
  userName: string;
  userEmail: string;
  userRole?: string;
  children: React.ReactNode;
}

const mainLinks = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/cameras", label: "Proveedores", icon: Satellite },
  { href: "/favorites", label: "Favoritas", icon: Star },
  { href: "/tv", label: "Modo TV", icon: Tv },
];

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function NavShell({
  userName,
  userEmail,
  userRole,
  children,
}: NavShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  // Hydrate collapsed state from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const linkClass = (href: string) =>
    [
      "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted hover:text-foreground transition-colors",
      isActive(href) ? "bg-muted text-foreground font-medium" : "text-muted-foreground",
    ].join(" ");

  const isAdmin = userRole === "admin";
  const canManage = userRole === "admin" || userRole === "operator";

  const NavLinks = () => (
    <>
      {mainLinks.map(({ href, label, icon: Icon }) => {
        if (href === "/cameras" && !canManage) return null;
        return (
          <Link
            key={href}
            href={href}
            className={linkClass(href)}
            onClick={() => setDrawerOpen(false)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin/users"
          className={linkClass("/admin/users")}
          onClick={() => setDrawerOpen(false)}
        >
          <Shield className="w-4 h-4 shrink-0" />
          Usuarios
        </Link>
      )}
    </>
  );

  const sidebarWidth = hydrated && collapsed ? "w-16" : "w-64";

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
          <Menu className="w-5 h-5" />
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
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 text-sm">
              <NavLinks />
            </nav>
            <div className="border-t border-border px-4 py-4 space-y-1">
              <p className="text-xs text-muted-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside
        className={[
          "hidden md:flex border-r border-border p-4 flex-col min-h-screen transition-all duration-200",
          sidebarWidth,
        ].join(" ")}
      >
        {/* Logo */}
        <div className="text-sm font-semibold text-foreground mb-4 truncate">
          {hydrated && collapsed ? "C" : "CamWatch"}
        </div>

        {/* Nav */}
        <nav className="space-y-1 text-sm flex-1">
          {hydrated && collapsed ? (
            /* Collapsed: icons only */
            <>
              {mainLinks.map(({ href, label, icon: Icon }) => {
                if (href === "/cameras" && !canManage) return null;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={[
                      "flex items-center justify-center py-2 rounded transition-colors",
                      isActive(href)
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin/users"
                  title="Usuarios"
                  className={[
                    "flex items-center justify-center py-2 rounded transition-colors",
                    isActive("/admin/users")
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}
            </>
          ) : (
            /* Expanded: full labels */
            <NavLinks />
          )}
        </nav>

        {/* User info — only when expanded */}
        {(!hydrated || !collapsed) && (
          <div className="border-t border-border pt-4 mt-4 space-y-1">
            <p className="text-xs text-muted-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            <LogoutButton />
          </div>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors border-t border-border mt-2"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {hydrated && collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
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
          <Home className="w-5 h-5" />
          <span>Inicio</span>
        </Link>
        {canManage && (
          <Link
            href="/cameras"
            className={[
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2",
              isActive("/cameras") ? "text-primary font-medium" : "text-muted-foreground",
            ].join(" ")}
          >
            <Satellite className="w-5 h-5" />
            <span>Proveedores</span>
          </Link>
        )}
        <Link
          href="/favorites"
          className={[
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2",
            isActive("/favorites") ? "text-primary font-medium" : "text-muted-foreground",
          ].join(" ")}
        >
          <Star className="w-5 h-5" />
          <span>Favoritas</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs py-2 text-muted-foreground"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}

