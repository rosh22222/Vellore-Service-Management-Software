import { ServiceStatus, type Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
export type DashboardSummary = {
  customers: number; equipment: number; newComplaints: number; completedToday: number; pending: number; warrantyServices: number;
  monthServiceValue: string; monthCollectedValue: string; paidForMonthlyServices: string; availableTechs: number; busyTechs: number;
};
// One consistent database snapshot and one network round trip for the KPI cards.
export async function getDashboardSummary(db: Pick<Prisma.TransactionClient, "$queryRaw">, start: Date, end: Date, monthStart: Date) {
  const [summary] = await db.$queryRaw<DashboardSummary[]>`SELECT
    (SELECT count(*)::int FROM "Customer") AS "customers",
    (SELECT count(*)::int FROM "CustomerEquipment") AS "equipment",
    (SELECT count(*)::int FROM "ServiceComplaint" WHERE "complaintDate" >= ${start} AND "complaintDate" < ${end}) AS "newComplaints",
    (SELECT count(*)::int FROM "ServiceRecord" WHERE "serviceDate" >= ${start} AND "serviceDate" < ${end}) AS "completedToday",
    (SELECT count(*)::int FROM "ServiceComplaint" WHERE "status" NOT IN ('SERVICE_COMPLETED','CLOSED','CANCELLED')) AS "pending",
    (SELECT count(*)::int FROM "ServiceRecord" WHERE "warrantyStatus" = 'UNDER_WARRANTY') AS "warrantyServices",
    (SELECT coalesce(sum("charges"), 0)::text FROM "ServiceRecord" WHERE "serviceDate" >= ${monthStart} AND "serviceDate" < ${end}) AS "monthServiceValue",
    (SELECT coalesce(sum("amount"), 0)::text FROM "ServiceCollection" WHERE "collectedAt" >= ${monthStart} AND "collectedAt" < ${end}) AS "monthCollectedValue",
    (SELECT coalesce(sum(c."amount"), 0)::text FROM "ServiceCollection" c JOIN "ServiceRecord" s ON s."id" = c."serviceRecordId" WHERE s."serviceDate" >= ${monthStart} AND s."serviceDate" < ${end}) AS "paidForMonthlyServices",
    (SELECT count(*)::int FROM "Technician" WHERE "isActive" = true AND "status" = 'AVAILABLE') AS "availableTechs",
    (SELECT count(*)::int FROM "Technician" WHERE "isActive" = true AND "status" = 'BUSY') AS "busyTechs"`;
  return summary;
}

// Dashboard numbers are shared by office users and are expensive when the app
// and Supabase are in different regions. Mutating actions invalidate this tag,
// so repeat navigation is fast without leaving the dashboard stale.
export const getCachedDashboardPageData = unstable_cache(
  async (startIso: string, endIso: string, monthStartIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const monthStart = new Date(monthStartIso);
    const [summary, monthlyStatusCounts, recentRows] = await Promise.all([
      getDashboardSummary(db, start, end, monthStart),
      db.serviceComplaint.groupBy({
        by: ["status"],
        where: {
          complaintDate: { gte: monthStart, lt: end },
          status: { not: ServiceStatus.CANCELLED },
        },
        _count: { _all: true },
      }),
      db.serviceComplaint.findMany({
        select: {
          id: true,
          complaintNumber: true,
          customerComplaint: true,
          status: true,
          complaintDate: true,
          customer: { select: { name: true } },
          equipment: { select: { name: true } },
        },
        orderBy: { complaintDate: "desc" },
        take: 4,
      }),
    ]);
    return {
      summary,
      monthlyStatusCounts,
      recentComplaints: recentRows.map((complaint) => ({
        ...complaint,
        complaintDate: complaint.complaintDate.toISOString(),
      })),
    };
  },
  ["dashboard-page-data-v1"],
  { revalidate: 5 * 60, tags: ["dashboard-data"] },
);
