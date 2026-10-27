import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  IndianRupee,
  Package,
  PlusCircle,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import {
  ServiceStatus,
  TechnicianStatus,
  WarrantyStatus,
} from "@prisma/client";
import { requireRoles } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { date, money } from "@/lib/format";
import { businessRange } from "@/lib/business-date";
import { getCachedDashboardPageData } from "@/lib/dashboard-summary";

const activeStatuses = [
  ServiceStatus.TECHNICIAN_ACCEPTED,
  ServiceStatus.TECHNICIAN_VISITING,
  ServiceStatus.INSPECTION_STARTED,
  ServiceStatus.PROBLEM_DIAGNOSED,
  ServiceStatus.REPAIR_IN_PROGRESS,
  ServiceStatus.WAITING_FOR_SPARE_PART,
  ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL,
];

export default async function DashboardPage() {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const { start, end: dayEnd } = businessRange("today");
  const end = new Date(dayEnd.getTime() + 1);
  const monthStart = businessRange("month").start;

  const { summary, monthlyStatusCounts, recentComplaints } =
    await getCachedDashboardPageData(
      start.toISOString(),
      end.toISOString(),
      monthStart.toISOString(),
    );

  const { customers, equipment, newComplaints, completedToday, pending, warrantyServices, availableTechs, busyTechs } = summary;
  const monthServiceValue = Number(summary.monthServiceValue);
  const monthCollectedValue = Number(summary.monthCollectedValue);
  const paidForMonthlyServices = Number(summary.paidForMonthlyServices);
  const activeTechnicians = availableTechs + busyTechs;
  const collectionRate =
    monthServiceValue > 0
      ? Math.min(
          100,
          Math.round((paidForMonthlyServices / monthServiceValue) * 100),
        )
      : 0;

  const countStatuses = (statuses: ServiceStatus[]) => monthlyStatusCounts.reduce(
    (total, row) => total + (statuses.includes(row.status) ? row._count._all : 0), 0,
  );
  const holdStatuses: ServiceStatus[] = [ServiceStatus.WAITING_FOR_SPARE_PART, ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL];
  const serviceProgressSegments = [
    { label: "Open", value: countStatuses([ServiceStatus.UNASSIGNED, ServiceStatus.TECHNICIAN_ASSIGNED]), color: "var(--primary)" },
    { label: "In Progress", value: countStatuses(activeStatuses.filter((status) => !holdStatuses.includes(status))), color: "var(--chart-cool)" },
    { label: "Completed", value: countStatuses([ServiceStatus.SERVICE_COMPLETED, ServiceStatus.CLOSED]), color: "var(--chart-success)" },
    { label: "On Hold", value: countStatuses(holdStatuses), color: "var(--chart-warm)" },
  ];
  const serviceProgressTotal = serviceProgressSegments.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  let serviceProgressCursor = 0;
  const serviceProgressBackground =
    serviceProgressTotal > 0
      ? `conic-gradient(${serviceProgressSegments
          .map((item) => {
            const startPercent = serviceProgressCursor;
            const endPercent =
              startPercent + (item.value / serviceProgressTotal) * 100;
            serviceProgressCursor = endPercent;
            return `${item.color} ${startPercent}% ${endPercent}%`;
          })
          .join(", ")})`
      : "var(--line)";

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="dashboard-hero relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-brand-accent/80 p-6 shadow-panel md:p-7">
          <div className="relative z-[2] max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/60 bg-white/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-primary">
              <Activity size={15} />
              Service Operations
            </div>
            <h1 className="mt-4 max-w-[14ch] text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em] text-brand-ink md:text-[2.35rem] 2xl:text-[2.65rem]">
              Service Control <span className="text-brand-primary">Dashboard</span>
            </h1>
            <p className="mt-2.5 max-w-[46ch] text-[13px] leading-5 text-brand-secondary">
              Manage complaints, technicians and service collections in one place.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
                href="/complaints/new"
              >
                <PlusCircle size={19} />
                New Complaint
                <ArrowRight size={17} />
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-input bg-white/90 px-4 py-2.5 text-xs font-semibold text-brand-secondary transition-colors hover:border-brand-accent hover:bg-white"
                href="/teams#technician-assignment"
              >
                <UserCog size={19} />
                Assign Technician
              </Link>
            </div>
          </div>

          <div className="relative z-[2] mt-auto grid gap-3 border-t border-brand-accent/45 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            {[
              { number: "01", label: "Register complaint" },
              { number: "02", label: "Assign technician" },
              { number: "03", label: "Resolve & collect" },
            ].map((step, index) => (
              <div key={step.number} className="contents">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-primary ring-1 ring-inset ring-brand-accent/45">
                    {step.number}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-brand-secondary sm:whitespace-normal">
                    {step.label}
                  </span>
                </div>
                {index < 2 && (
                  <ArrowRight
                    aria-hidden="true"
                    size={16}
                    className="hidden shrink-0 text-brand-muted sm:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="min-w-0 rounded-2xl border border-brand-border bg-white p-5 shadow-panel md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-brand-ink">
              Today&apos;s Service Status
            </h2>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-muted">
              <CalendarDays size={15} />
              {date(start)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              {
                label: "New complaints",
                value: newComplaints,
                icon: <FileText size={21} />,
                surface: "border-brand-accent/50 bg-brand-soft/75",
                iconColor: "text-brand-primary",
              },
              {
                label: "Open services",
                value: pending,
                icon: <Wrench size={21} />,
                surface: "border-brand-ice bg-brand-ice/55",
                iconColor: "text-brand-cool-ink",
              },
              {
                label: "Completed today",
                value: completedToday,
                icon: <CheckCircle2 size={21} />,
                surface: "border-emerald-100 bg-emerald-50/70",
                iconColor: "text-emerald-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-3 sm:p-3.5 ${item.surface}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow-sm [&>svg]:h-[18px] [&>svg]:w-[18px] ${item.iconColor}`}>
                  {item.icon}
                </div>
                <div className="mt-3 text-[1.65rem] font-semibold leading-none tracking-tight text-brand-ink tabular-nums">
                  {item.value}
                </div>
                <p className="mt-2 text-[11px] font-medium leading-4 text-brand-secondary">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-brand-warm/45 bg-brand-warm-soft/45 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-warm/35 text-brand-warm-ink">
                <BarChart3 size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-brand-ink">
                      Monthly Collection Progress
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-brand-muted">
                      {money(paidForMonthlyServices)} collected from{" "}
                      {money(monthServiceValue)}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-brand-primary tabular-nums">
                    {collectionRate}%
                  </div>
                </div>
                <div role="progressbar" aria-label="Monthly collection progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={collectionRate} className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-border">
                  <div
                    className="h-full rounded-full bg-brand-primary"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open Services"
          value={pending}
          hint="Needs follow-up or completion"
          icon={<FileText size={24} />}
          tone="blue"
          href="/complaints"
        />
        <StatCard
          label="New Complaints Today"
          value={newComplaints}
          hint="Fresh customer issues received"
          icon={<AlertTriangle size={24} />}
          tone="amber"
          href="/complaints"
        />
        <StatCard
          label="Completed Today"
          value={completedToday}
          hint="Closed service work today"
          icon={<CheckCircle2 size={24} />}
          tone="teal"
          href="/service-history"
        />
        <StatCard
          label="Collected This Month"
          value={money(monthCollectedValue)}
          hint="Payments received this month"
          icon={<IndianRupee size={24} />}
          tone="emerald"
          href="/service-collections"
        />
        <StatCard
          label="Customers"
          value={customers}
          hint="Saved customer profiles"
          icon={<Users size={24} />}
          tone="violet"
          href="/customers"
        />
        <StatCard
          label="Registered Products"
          value={equipment}
          hint="Products linked with customers"
          icon={<Package size={24} />}
          tone="cool"
          href="/bill-details"
        />
        <StatCard
          label="Warranty Services"
          value={warrantyServices}
          hint="Service records under warranty"
          icon={<ShieldCheck size={24} />}
          tone="teal"
          href="/service-history"
        />
        <StatCard
          label="Technicians"
          value={`${availableTechs} / ${activeTechnicians}`}
          hint="Available / total active"
          icon={<UserCog size={24} />}
          tone="slate"
          href="/teams#team-management"
        />
      </div>

      <section className="grid items-start gap-5 min-[1700px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Recent Service Complaints"
            action={
              <Link
                href="/complaints"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary transition-colors hover:text-brand-primary-hover"
              >
                View All
                <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Equipment</th>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <Link
                        className="link"
                        href={`/complaints/${complaint.id}`}
                      >
                        {complaint.complaintNumber}
                      </Link>
                    </td>
                    <td>{complaint.customer.name}</td>
                    <td>
                      {complaint.equipment?.name ?? "No equipment selected"}
                    </td>
                    <td className="max-w-xs">{complaint.customerComplaint}</td>
                    <td>
                      <Badge value={complaint.status} />
                    </td>
                    <td>{date(complaint.complaintDate)}</td>
                  </tr>
                ))}
                {recentComplaints.length === 0 && (
                  <tr>
                    <td colSpan={6}>No service complaints yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid min-w-0 items-stretch gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Service Progress"
              action={
                <div className="rounded-lg bg-brand-subtle px-2.5 py-1.5 text-[10px] font-medium text-brand-muted">
                  This Month
                </div>
              }
            />
            <CardBody>
              <div className="flex flex-wrap items-center justify-center gap-5">
                <div
                  role="img"
                  aria-label={`Service progress this month: ${serviceProgressSegments.map((item) => `${item.label} ${item.value}`).join(", ")}`}
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{ background: serviceProgressBackground }}
                >
                  <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center">
                    <div>
                      <div className="text-xs font-semibold text-brand-muted">
                        Total
                      </div>
                      <div className="my-1 text-[1.75rem] font-semibold leading-none text-brand-ink tabular-nums">
                        {serviceProgressTotal}
                      </div>
                      <div className="text-xs font-semibold text-brand-muted">
                        Services
                      </div>
                    </div>
                  </div>
                </div>
                <div className="min-w-[125px] flex-1 space-y-3">
                  {serviceProgressSegments.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="flex items-center gap-2 font-medium text-brand-secondary">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="font-bold text-brand-ink">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <CardBody className="space-y-2">
              {[
                {
                  href: "/complaints/new",
                  label: "New Service Complaint",
                  icon: <FileText size={18} />,
                },
                {
                  href: "/teams#technician-assignment",
                  label: "Assign Technician",
                  icon: <UserCog size={18} />,
                },
                {
                  href: "/customers/new",
                  label: "Add Customer",
                  icon: <Users size={18} />,
                },
                {
                  href: "/reports",
                  label: "View Reports",
                  icon: <BarChart3 size={18} />,
                },
              ].map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    index === 0
                      ? "border-brand-accent/60 bg-brand-soft text-brand-primary hover:border-brand-primary"
                      : "border-brand-border bg-white text-brand-ink hover:border-brand-accent hover:bg-brand-subtle"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {action.icon}
                    {action.label}
                  </span>
                  <ArrowRight size={15} className="shrink-0" />
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

