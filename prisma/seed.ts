import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Admin inicial
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@camwatch.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        passwordHash,
        role: UserRole.admin,
        status: UserStatus.active,
      },
    });
    console.log(`✅ Admin creado: ${admin.email}`);
  } else {
    console.log(`⏭️  Admin ya existe: ${adminEmail}`);
  }

  // EdgeServer de ejemplo (para desarrollo)
  const existingEdge = await prisma.edgeServer.findFirst({
    where: { tailscaleIp: "100.64.0.1" },
  });

  if (!existingEdge) {
    const edge = await prisma.edgeServer.create({
      data: {
        name: "Servidor Edge Local (Dev)",
        tailscaleIp: "100.64.0.1",
        mediamtxApiPort: 9997,
        webrtcPort: 8889,
        publicHost: "localhost",
      },
    });
    console.log(`✅ EdgeServer creado: ${edge.name}`);
  } else {
    console.log("⏭️  EdgeServer ya existe.");
  }

  console.log("✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
