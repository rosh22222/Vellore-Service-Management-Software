import { ServiceStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { BarChart3, CheckCircle2, Clock3, Download, IndianRupee, ShieldCheck, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "@/components/download-link";
import { Field, Input, Select } from "@/components/ui/form";
import {
  DonutChart,
  HorizontalBarList,
  StackedMeter,
} from "@/components/ui/charts";
import { date, money } from "@/lib/format";
import { businessRange, dateBoundary } from "@/lib/business-date";

const closedStatuses = [
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];

type ReportSummary = {
  complaints: number;
  completed: number;
  pending: number;
  warranty: number;
  outWarranty: number;
  revenue: string;
};

type TechnicianReportRow = {
  id: string;
  name: string;
  count: number;
  pendingCount: number;
  inProgress: number;
};

type FrequentEquipmentRow = {
  id: string;
  label: string;
  value: number;
  hint: string;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const p = await searchParams;
  const period = p.period ?? "month";
  const { start, end } = businessRange(period, p.from, p.to);
  const invalidRange = period === "custom" && (!dateBoundary(p.from) || (p.to && (!dateBoundary(p.to) || p.from! > p.to)));

  const getCachedReportData = unstable_cache(
    async () => Promise.all([
    db.$queryRaw<ReportSummary[]>`SELECT
      (SELECT count(*)::int FROM "ServiceComplaint" WHERE "complaintDate" >= ${start} AND "complaintDate" <= ${end}) AS "complaints",
      (SELECT count(*)::int FROM "ServiceRecord" WHERE "serviceDate" >= ${start} AND "serviceDate" <= ${end}) AS "completed",
      (SELECT count(*)::int FROM "ServiceComplaint" WHERE "complaintDate" >= ${start} AND "complaintDate" <= ${end} AND "status" NOT IN ('SERVICE_COMPLETED','CLOSED','CANCELLED')) AS "pending",
      (SELECT count(*)::int FROM "ServiceRecord" WHERE "serviceDate" >= ${start} AND "serviceDate" <= ${end} AND "warrantyStatus" = 'UNDER_WARRANTY') AS "warranty",
      (SELECT count(*)::int FROM "ServiceRecord" WHERE "serviceDate" >= ${start} AND "serviceDate" <= ${end} AND "warrantyStatus" = 'OUT_OF_WARRANTY') AS "outWarranty",
      (SELECT coalesce(sum("amount"), 0)::text FROM "ServiceCollection" WHERE "collectedAt" >= ${start} AND "collectedAt" <= ${end}) AS "revenue"`,
    db.serviceRecord.findMany({
      where: { serviceDate: { gte: start, lte: end } },
      include: {
        customer: true,
        equipment: true,
        technician: true,
        collections: { select: { amount: true } },
      },
      orderBy: { serviceDate: "desc" },
    }),
    db.serviceComplaint.findMany({
      where: {
        complaintDate: { gte: start, lte: end },
        status: { notIn: closedStatuses },
      },
      include: {
        customer: true,
        equipment: true,
        assignments: {
          where: { isActive: true },
          include: { technician: true },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: [{ priority: "desc" }, { complaintDate: "asc" }],
      take: 100,
    }),
    db.$queryRaw<FrequentEquipmentRow[]>`SELECT
      e."id" AS "id",
      e."name" AS "label",
      count(*)::int AS "value",
      concat(c."name", ' • ', e."equipmentCode") AS "hint"
    FROM "ServiceRecord" s
    JOIN "CustomerEquipment" e ON e."id" = s."equipmentId"
    JOIN "Customer" c ON c."id" = e."customerId"
    WHERE s."serviceDate" >= ${start} AND s."serviceDate" <= ${end}
    GROUP BY e."id", e."name", e."equipmentCode", c."name"
    ORDER BY count(*) DESC
    LIMIT 10`,
    db.serviceComplaint.findMany({
      where: {
        repeatIssueDetected: true,
        complaintDate: { gte: start, lte: end },
      },
      include: { customer: true, equipment: true },
      orderBy: { complaintDate: "desc" },
      take: 25,
    }),
    db.$queryRaw<TechnicianReportRow[]>`SELECT
      t."id" AS "id",
      t."name",
      (SELECT count(*)::int
       FROM "ServiceRecord" s
       WHERE s."serviceDate" >= ${start}
         AND s."serviceDate" <= ${end}
         AND (
           s."technicianId" = t."id"
           OR EXISTS (
             SELECT 1
             FROM "ServiceAssignment" a
             WHERE a."complaintId" = s."complaintId"
               AND a."technicianId" = t."id"
               AND a."endedReason" = 'Service completed'
           )
         )) AS "count",
      (SELECT count(*)::int FROM "ServiceComplaint" c WHERE c."status" NOT IN ('SERVICE_COMPLETED','CLOSED','CANCELLED') AND EXISTS (SELECT 1 FROM "ServiceAssignment" a WHERE a."complaintId" = c."id" AND a."technicianId" = t."id" AND a."isActive" = true)) AS "pendingCount",
      (SELECT count(*)::int FROM "ServiceComplaint" c WHERE c."status" IN ('TECHNICIAN_VISITING','INSPECTION_STARTED','PROBLEM_DIAGNOSED','REPAIR_IN_PROGRESS') AND EXISTS (SELECT 1 FROM "ServiceAssignment" a WHERE a."complaintId" = c."id" AND a."technicianId" = t."id" AND a."isActive" = true)) AS "inProgress"
    FROM "Technician" t
    WHERE t."isActive" = true
    ORDER BY t."name" ASC`,
    ]),
    ["reports-page-data-v1", start.toISOString(), end.toISOString()],
    { revalidate: 5 * 60, tags: ["reports-data"] },
  );
  const [summaryRows, services, pendingRows, frequentEquipment, repeats, techStats] =
    await getCachedReportData();

  const summary = summaryRows[0] ?? {
    complaints: 0,
    completed: 0,
    pending: 0,
    warranty: 0,
    outWarranty: 0,
    revenue: "0",
  };
  const { complaints, completed, pending, warranty, outWarranty } = summary;

  const serviceAmount = services.reduce(
    (sum, service) => sum + Number(service.charges),
    0,
  );
  const revenue = Number(summary.revenue);
  const collectedForServices = services.reduce((sum, service) =>
    sum + service.collections.reduce((paid, collection) => paid + Number(collection.amount), 0), 0);
  const pendingCollection = Math.max(0, serviceAmount - collectedForServices);

  const frequentEquipmentBars = frequentEquipment.map((row) => ({
    ...row,
    color: "var(--primary)",
  }));
  const collectionSegments = [
    {
      label: "Collected for these services",
      value: collectedForServices,
      hint: money(collectedForServices),
      color: "var(--chart-success)",
    },
    {
      label: "Pending",
      value: pendingCollection,
      hint: money(pendingCollection),
      color: "var(--chart-warm)",
    },
  ];
  const technicianBars = techStats.map((technician) => ({
    id: technician.id,
    label: technician.name,
    value: technician.count,
    hint: `${technician.pendingCount} open, ${technician.inProgress} in progress`,
    color: "var(--primary)",
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Service performance, collection health, warranty mix, technician output and repeat complaint indicators."
      />

      {invalidRange && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Choose a valid start and end date. Showing this month until the range is corrected.</p>}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-brand-border bg-white p-5 shadow-panel">
        <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto">
          <Field label="Report period">
            <Select name="period" defaultValue={period}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </Select>
          </Field>
          <Field label="From date"><Input type="date" name="from" defaultValue={p.from} /></Field>
          <Field label="To date"><Input type="date" name="to" defaultValue={p.to} /></Field>
        </div>
        <Button>Apply Filters</Button>
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <DownloadLink
            href={`/api/reports/export?format=csv&from=${start.toISOString()}&to=${end.toISOString()}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-xs font-semibold text-brand-secondary transition-colors hover:border-brand-accent hover:bg-brand-faint"
          ><Download size={15} /> Export CSV</DownloadLink>
          <DownloadLink preview
            href={`/api/reports/export?format=pdf&from=${start.toISOString()}&to=${end.toISOString()}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-xs font-semibold text-brand-secondary transition-colors hover:border-brand-accent hover:bg-brand-faint"
          ><Download size={15} /> Export PDF</DownloadLink>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Complaints" value={complaints} icon={<Wrench size={20} />} />
        <StatCard
          label="Completed"
          tone="teal"
          value={completed}
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard label="Pending" value={pending} tone="amber" icon={<Clock3 size={20} />} />
        <StatCard
          label="Service Amount"
          value={money(serviceAmount)}
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label="Collected"
          tone="teal"
          value={money(revenue)}
          icon={<IndianRupee size={20} />}
        />
        <StatCard
          label="Pending Collection"
          tone="amber"
          value={money(pendingCollection)}
          icon={<IndianRupee size={20} />}
        />
        <StatCard
          label="Under Warranty"
          tone="teal"
          value={warranty}
          icon={<ShieldCheck size={20} />}
        />
        <StatCard
          label="Out of Warranty"
          value={outWarranty}
          icon={<ShieldCheck size={20} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Service Outcome"
            subtitle="Completed services compared with pending work."
          />
          <CardBody>
            <DonutChart
              segments={[
                { label: "Completed", value: completed, color: "var(--chart-success)" },
                { label: "Pending", value: pending, color: "var(--chart-warm)" },
              ]}
              center={
                <>
                  <div className="text-3xl font-bold text-brand-ink">
                    {completed + pending}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    service load
                  </div>
                </>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Collection Health"
            subtitle="Collected amount versus pending service collection."
          />
          <CardBody>
            <StackedMeter items={collectionSegments} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader
            title="Technician Performance"
            subtitle="Completed services in the selected period."
          />
          <CardBody>
            <HorizontalBarList
              items={technicianBars}
              formatValue={(value) => `${value} done`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Warranty Mix"
            subtitle="Warranty status of completed services."
          />
          <CardBody>
            <DonutChart
              segments={[
                { label: "Under warranty", value: warranty, color: "var(--chart-cool)" },
                { label: "Out of warranty", value: outWarranty, color: "var(--chart-warm)" },
              ]}
              center={
                <>
                  <div className="text-3xl font-bold text-brand-ink">
                    {warranty + outWarranty}
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    services
                  </div>
                </>
              }
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
        <Card>
          <CardHeader
            title="Frequently Serviced Equipment"
            subtitle="Products receiving repeated service attention."
          />
          <CardBody>
            <HorizontalBarList
              items={frequentEquipmentBars}
              formatValue={(value) => `${value} services`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Repeat Complaint Indicators"
            subtitle="Complaints where the software detected a similar previous issue."
          />
          <CardBody>
            <div className="space-y-3">
              {repeats.map((repeat) => (
                <div
                  key={repeat.id}
                  className="rounded-2xl border border-brand-border/70 bg-brand-subtle p-4"
                >
                  <div className="font-bold text-brand-ink">
                    {repeat.customer.name} - {repeat.equipment?.name ?? "Equipment"}
                  </div>
                  <div className="mt-1 text-sm font-medium text-brand-muted">
                    {repeat.customerComplaint}
                  </div>
                </div>
              ))}
              {repeats.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-input bg-brand-subtle p-5 text-sm font-semibold text-brand-muted">
                  No repeat indicators in this period.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Pending Services Report" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Complaint</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Equipment</th>
                <th>Technician</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.complaintNumber}</td>
                  <td>{date(complaint.complaintDate)}</td>
                  <td>{complaint.customer.name}</td>
                  <td>{complaint.equipment?.name ?? "No equipment"}</td>
                  <td>
                    {complaint.assignments.length
                      ? complaint.assignments.map((assignment) => assignment.technician.name).join(", ")
                      : "Unassigned"}
                  </td>
                  <td>{complaint.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
              {pendingRows.length === 0 && (
                <tr>
                  <td colSpan={6}>No pending services in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Completed Service Detail" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Equipment</th>
                <th>Problem</th>
                <th>Technician</th>
                <th>Warranty</th>
                <th>Service Amount</th>
                <th>Collected</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const collected = service.collections.reduce(
                  (sum, collection) => sum + Number(collection.amount),
                  0,
                );
                const pendingAmount = Math.max(
                  0,
                  Number(service.charges) - collected,
                );
                return (
                  <tr key={service.id}>
                    <td>{date(service.serviceDate)}</td>
                    <td>{service.serviceNumber}</td>
                    <td>{service.customer.name}</td>
                    <td>{service.equipment?.name ?? "No equipment"}</td>
                    <td>{service.problemFound}</td>
                    <td>
                      {service.technicianNameSnapshot ??
                        service.technician?.name ??
                        "No technician"}
                    </td>
                    <td>{service.warrantyStatus.replaceAll("_", " ")}</td>
                    <td>{money(service.charges)}</td>
                    <td>{money(collected)}</td>
                    <td>{money(pendingAmount)}</td>
                  </tr>
                );
              })}
              {services.length === 0 && (
                <tr>
                  <td colSpan={10}>No completed service records in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}


