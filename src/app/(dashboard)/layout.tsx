import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — CamWatch",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar — se implementa en Sprint 1 */}
      <aside className="w-64 border-r border-border p-4">
        <div className="text-sm font-semibold text-foreground mb-4">
          CamWatch
        </div>
        <nav className="space-y-1 text-sm text-muted-foreground">
          <div>Dashboard</div>
          <div>Cámaras</div>
          <div>Layouts</div>
          <div>Usuarios</div>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
