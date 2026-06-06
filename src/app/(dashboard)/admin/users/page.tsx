import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersPageClient } from "./users-page-client";

export const metadata: Metadata = { title: "Usuarios — CamWatch" };

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra las cuentas del sistema
        </p>
      </div>
      <UsersPageClient />
    </div>
  );
}
