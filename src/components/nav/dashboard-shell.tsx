"use client";

import { NavShell } from "./nav-shell";

interface DashboardShellProps {
  userName: string;
  userEmail: string;
  userRole?: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, userEmail, userRole, children }: DashboardShellProps) {
  return (
    <NavShell userName={userName} userEmail={userEmail} userRole={userRole}>
      {children}
    </NavShell>
  );
}
