import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const production = process.env.NODE_ENV === "production";
  const configuredPassword = process.env.VFE_ADMIN_PASSWORD;
  if (production && (!configuredPassword || configuredPassword.length < 12)) {
    throw new Error("Set VFE_ADMIN_PASSWORD to a unique password of at least 12 characters before production seeding.");
  }
  const adminPassword = await bcrypt.hash(configuredPassword || "Admin@123", 12);

  await prisma.companySetting.upsert({
    where: { id: "company" },
    update: {},
    create: {
      id: "company",
      companyName: "VELLORE FITNESS EQUIPMENTS",
      address: "Vellore, Tamil Nadu",
      primaryColor: "#0f172a",
      secondaryColor: "#f97316",
    },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "D SATHYAN",
      username: "admin",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      canAssignTechnician: true,
      canGenerateBills: true,
    },
  });

  for (const seq of [
    ["customer", 0],
    ["equipment", 0],
    ["complaint", 0],
    ["technician", 0],
    ["service", 0],
    ["part", 0],
  ] as const) {
    await prisma.documentSequence.upsert({
      where: { key: seq[0] },
      // Never move a production sequence backwards when seed is re-run.
      update: {},
      create: { key: seq[0], value: seq[1] },
    });
  }

  console.log("Seed complete.");
  console.log("Owner username: admin. Existing credentials are preserved; passwords are not printed.");
  console.log("Add technicians from /teams.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
