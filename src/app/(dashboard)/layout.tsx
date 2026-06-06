import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { NavShell } from "@/components/nav/nav-shell";

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
    <NavShell
      userName={user.name ?? ""}
      userEmail={user.email ?? ""}
    >
      {children}
    </NavShell>
  );
}
