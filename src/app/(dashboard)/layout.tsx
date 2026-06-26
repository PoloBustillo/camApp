import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/nav/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard — CamWatch",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const user = session.user;

  return (
    <DashboardShell userName={user.name ?? ""} userEmail={user.email ?? ""} userRole={user.role}>
      {children}
    </DashboardShell>
  );
}
