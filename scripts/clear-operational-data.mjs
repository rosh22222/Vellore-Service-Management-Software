import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient, TechnicianStatus } = require("@prisma/client");

const prisma = new PrismaClient();
const execute = process.argv.includes("--confirm-clear-operational-data");

function databaseTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.hostname}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "configured DATABASE_URL";
  }
}

async function counts() {
  const [
    users,
    technicians,
    brands,
    companySettings,
    customers,
    equipment,
    bills,
    billItems,
    billUnits,
    complaints,
    assignments,
    inspections,
    workLogs,
    statusHistory,
    serviceParts,
    serviceRecords,
    collections,
    spareParts,
    sequences,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.technician.count(),
    prisma.brand.count(),
    prisma.companySetting.count(),
    prisma.customer.count(),
    prisma.customerEquipment.count(),
    prisma.billDetail.count(),
    prisma.billDetailItem.count(),
    prisma.billDetailItemUnit.count(),
    prisma.serviceComplaint.count(),
    prisma.serviceAssignment.count(),
    prisma.serviceInspection.count(),
    prisma.serviceWorkLog.count(),
    prisma.serviceStatusHistory.count(),
    prisma.servicePart.count(),
    prisma.serviceRecord.count(),
    prisma.serviceCollection.count(),
    prisma.sparePart.count(),
    prisma.documentSequence.findMany({ orderBy: { key: "asc" } }),
  ]);
  return {
    retained: { users, technicians, brands, companySettings },
    operational: {
      customers,
      equipment,
      bills,
      billItems,
      billUnits,
      complaints,
      assignments,
      inspections,
      workLogs,
      statusHistory,
      serviceParts,
      serviceRecords,
      collections,
      spareParts,
    },
    sequences: Object.fromEntries(sequences.map((row) => [row.key, row.value])),
  };
}

try {
  console.log(`Database target: ${databaseTarget()}`);
  console.log("Before:");
  console.log(JSON.stringify(await counts(), null, 2));

  if (!execute) {
    console.log(
      "Dry run only. Pass --confirm-clear-operational-data to perform the transaction.",
    );
    process.exitCode = 2;
  } else {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const collections = await tx.serviceCollection.deleteMany();
        const serviceParts = await tx.servicePart.deleteMany();
        const serviceRecords = await tx.serviceRecord.deleteMany();
        const complaints = await tx.serviceComplaint.deleteMany();
        const billUnits = await tx.billDetailItemUnit.deleteMany();
        const billItems = await tx.billDetailItem.deleteMany();
        const bills = await tx.billDetail.deleteMany();
        const equipment = await tx.customerEquipment.deleteMany();
        const customers = await tx.customer.deleteMany();
        const spareParts = await tx.sparePart.deleteMany();
        const resetSequences = await tx.documentSequence.deleteMany({
          where: {
            key: {
              in: [
                "customer",
                "equipment",
                "complaint",
                "service",
                "service_collection",
                "part",
              ],
            },
          },
        });
        const availableTechnicians = await tx.technician.updateMany({
          where: { status: TechnicianStatus.BUSY },
          data: { status: TechnicianStatus.AVAILABLE },
        });
        return {
          collections: collections.count,
          serviceParts: serviceParts.count,
          serviceRecords: serviceRecords.count,
          complaints: complaints.count,
          billUnits: billUnits.count,
          billItems: billItems.count,
          bills: bills.count,
          equipment: equipment.count,
          customers: customers.count,
          spareParts: spareParts.count,
          resetSequences: resetSequences.count,
          techniciansChangedFromBusyToAvailable: availableTechnicians.count,
        };
      },
      { maxWait: 20_000, timeout: 120_000 },
    );

    console.log("Deleted/reset in one transaction:");
    console.log(JSON.stringify(deleted, null, 2));
    console.log("After:");
    console.log(JSON.stringify(await counts(), null, 2));
  }
} finally {
  await prisma.$disconnect();
}
