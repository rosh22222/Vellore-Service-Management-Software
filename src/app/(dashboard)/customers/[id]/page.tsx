import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceStatus, WarrantyStatus } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Dumbbell,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { date, money, titleCase } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";

const terminalComplaintStatuses = [
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];

const profileSections = [
  { label: "Contact", id: "contact" },
  { label: "Bill References", id: "stored-bill-references" },
  { label: "Products", id: "equipment" },
  { label: "Open Complaints", id: "open-complaints" },
  { label: "Service History", id: "service-history" },
];

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      equipment: { orderBy: { createdAt: "desc" } },
      complaints: {
        where: {
          status: {
            notIn: terminalComplaintStatuses,
          },
        },
        include: { equipment: true, currentTechnician: true },
        orderBy: { complaintDate: "desc" },
      },
      serviceRecords: {
        include: { equipment: true, technician: true },
        orderBy: { serviceDate: "desc" },
      },
      billDetails: {
        include: { items: true },
        orderBy: [{ createdAt: "desc" }, { billDate: "desc" }],
        take: 10,
      },
    },
  });
  if (!c) notFound();

  const initials = c.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const customerType = titleCase(c.type);
  const address = [c.address, c.city, c.state, c.pinCode]
    .filter(Boolean)
    .join(", ");
  const totalBillValue = c.billDetails.reduce(
    (sum, bill) => sum + Number(bill.total),
    0,
  );
  const totalServiceValue = c.serviceRecords.reduce(
    (sum, service) => sum + Number(service.charges),
    0,
  );
  const activeWarrantyCount = c.equipment.filter(
    (item) =>
      warrantyStatus(item.warrantyExpiryDate) ===
      WarrantyStatus.UNDER_WARRANTY,
  ).length;
  const latestBill = c.billDetails[0];
  const latestService = c.serviceRecords[0];

  return (
    <>
      <PageHeader
        title="Customer Profile"
        description="Customer contact, purchased products, stored bill references, open complaints and completed service history in one place."
      />

      <section className="mb-6 overflow-hidden rounded-xl border border-brand-border bg-white shadow-panel">
        <div className="grid gap-6 p-5 md:p-6 xl:grid-cols-[1.25fr_.75fr]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-4xl font-bold text-white">
              {initials || "VF"}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-primary ring-1 ring-brand-border">
                  {c.customerCode}
                </span>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-primary">
                  {customerType}
                </span>
              </div>
              <h2 className="truncate text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
                {c.name}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-brand-muted">
                Manage this customer&apos;s product purchases, warranty details,
                complaints and service work from this profile.
              </p>
            </div>
          </div>

          <div className="grid content-center gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ActionLink
              href={`/customers/${c.id}/edit`}
              icon={Pencil}
              label="Edit Customer"
              variant="light"
            />
            <ActionLink
              href="/bill-details/new"
              icon={ReceiptText}
              label="Add Bill Details"
              variant="primary"
            />
            <ActionLink
              href={`/complaints/new?customerId=${c.id}`}
              icon={Wrench}
              label="New Complaint"
              variant="dark"
            />
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Dumbbell}
          label="Registered Products"
          value={c.equipment.length}
          hint={`${activeWarrantyCount} under warranty`}
        />
        <MetricCard
          icon={ReceiptText}
          label="Bill References"
          value={c.billDetails.length}
          hint={`${money(totalBillValue)} stored value`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Open Complaints"
          value={c.complaints.length}
          hint={c.complaints.length ? "Needs follow-up" : "No active issue"}
        />
        <MetricCard
          icon={History}
          label="Completed Services"
          value={c.serviceRecords.length}
          hint={`${money(totalServiceValue)} service value`}
        />
      </div>

      <nav
        className="sticky top-[88px] z-10 mb-6 flex gap-2 overflow-x-auto rounded-xl border border-brand-border bg-white p-2 text-sm font-bold shadow-sm"
        aria-label="Customer profile sections"
      >
        {profileSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="whitespace-nowrap rounded-xl px-4 py-2.5 text-brand-muted transition hover:bg-brand-soft hover:text-brand-primary"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div
        id="contact"
        className="grid scroll-mt-32 gap-6 xl:grid-cols-[1.1fr_.9fr]"
      >
        <Card className="border-brand-border">
          <CardHeader
            title="Contact & Location"
            subtitle="Primary information needed by office staff and technicians."
          />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <InfoTile
              icon={Phone}
              label="Primary Mobile"
              value={c.primaryMobile}
            />
            <InfoTile
              icon={Phone}
              label="Alternate Mobile"
              value={c.alternateMobile || "Not added"}
            />
            <InfoTile icon={Mail} label="Email" value={c.email || "Not added"} />
            <InfoTile
              icon={BadgeCheck}
              label="GST Number"
              value={c.gstNumber || "Not added"}
            />
            <div className="md:col-span-2">
              <InfoTile icon={MapPin} label="Full Address" value={address} />
            </div>
          </CardBody>
        </Card>

        <Card className="border-brand-border">
          <CardHeader
            title="Customer Snapshot"
            subtitle="Quick status before creating a complaint or service visit."
          />
          <CardBody className="space-y-4">
            <div className="rounded-2xl bg-brand-subtle p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                Latest Bill Reference
              </div>
              {latestBill ? (
                <Link
                  className="mt-2 block text-lg font-bold text-brand-primary hover:underline"
                  href={`/bill-details/${latestBill.id}`}
                >
                  {latestBill.billNumber}
                </Link>
              ) : (
                <div className="mt-2 text-sm font-semibold text-brand-muted">
                  No bill reference saved yet.
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-brand-subtle p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                Latest Completed Service
              </div>
              {latestService ? (
                <Link
                  className="mt-2 block text-lg font-bold text-brand-primary hover:underline"
                  href={`/service-history/${latestService.id}`}
                >
                  {latestService.serviceNumber} -{" "}
                  {date(latestService.serviceDate)}
                </Link>
              ) : (
                <div className="mt-2 text-sm font-semibold text-brand-muted">
                  No completed service yet.
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-dashed border-brand-border p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                Notes
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-brand-secondary">
                {c.notes || "No customer notes added."}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div id="stored-bill-references" className="scroll-mt-32">
        <Card className="mt-6 border-brand-border">
          <CardHeader
            title="Stored Bill References"
            subtitle="Bills already given to the customer, stored here for service and warranty lookup."
            action={
              <Link
                className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-primary-hover"
                href="/bill-details/new"
              >
                + New Bill
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Products</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {c.billDetails.map((bill) => (
                  <tr key={bill.id}>
                    <td>
                      <Link className="link" href={`/bill-details/${bill.id}`}>
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td>{date(bill.billDate)}</td>
                    <td className="max-w-xl">
                      {bill.items.map((item) => item.itemName).join(", ") ||
                        "No products added"}
                    </td>
                    <td className="font-bold text-brand-ink">
                      {money(bill.total)}
                    </td>
                    <td>
                      <Link
                        className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-bold text-brand-primary hover:bg-brand-soft"
                        href={`/bill-details/${bill.id}`}
                      >
                        Open Bill
                      </Link>
                    </td>
                  </tr>
                ))}
                {c.billDetails.length === 0 && (
                  <EmptyTableRow
                    colSpan={5}
                    text="No stored bill reference saved for this customer."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="equipment" className="scroll-mt-32">
        <Card className="mt-6 border-brand-border">
          <CardHeader
            title="Products / Equipment"
            subtitle={`${c.equipment.length} registered product(s) linked with this customer.`}
            action={
              <Link
                className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-primary hover:bg-brand-soft"
                href={`/equipment/new?customerId=${c.id}`}
              >
                + Add Product
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand / Model</th>
                  <th>Serial</th>
                  <th>Warranty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {c.equipment.map((e) => {
                  const warranty = warrantyStatus(e.warrantyExpiryDate);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link className="link" href={`/equipment/${e.id}`}>
                          {e.name}
                        </Link>
                        <div className="text-xs text-brand-muted">
                          {e.equipmentCode}
                        </div>
                      </td>
                      <td>
                        {e.brand || "Brand not added"}
                        <div className="text-xs text-brand-muted">
                          {e.modelNumber || "No model"}
                        </div>
                      </td>
                      <td>{e.serialNumber || "No serial"}</td>
                      <td>
                        <Badge value={warranty} />
                        <div className="mt-1 text-xs text-brand-muted">
                          {e.warrantyExpiryDate
                            ? `Expiry: ${date(e.warrantyExpiryDate)}`
                            : "No Warranty"}
                        </div>
                      </td>
                      <td>
                        <Link
                          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-bold text-brand-primary hover:bg-brand-soft"
                          href={`/equipment/${e.id}`}
                        >
                          Open Product
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {c.equipment.length === 0 && (
                  <EmptyTableRow
                    colSpan={5}
                    text="No product or equipment is linked with this customer yet."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="open-complaints" className="scroll-mt-32">
        <Card className="mt-6 border-brand-border">
          <CardHeader
            title="Open Complaints"
            subtitle="Active issues that still need assignment, visit or completion."
            action={
              <Link
                className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-primary-hover"
                href={`/complaints/new?customerId=${c.id}`}
              >
                + New Complaint
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Problem</th>
                  <th>Technician</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {c.complaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <Link
                        className="link"
                        href={`/complaints/${complaint.id}`}
                      >
                        {complaint.complaintNumber}
                      </Link>
                    </td>
                    <td>{date(complaint.complaintDate)}</td>
                    <td>{complaint.equipment?.name || "Not selected"}</td>
                    <td className="max-w-md">{complaint.customerComplaint}</td>
                    <td>
                      {complaint.currentTechnician?.name || "Not assigned"}
                    </td>
                    <td>
                      <Badge value={complaint.status} />
                    </td>
                  </tr>
                ))}
                {c.complaints.length === 0 && (
                  <EmptyTableRow
                    colSpan={6}
                    text="No open complaint for this customer."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div id="service-history" className="scroll-mt-32">
        <Card className="mt-6 border-brand-border">
          <CardHeader
            title="Service History"
            subtitle="Permanent completed service records for this customer."
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Problem Found</th>
                  <th>Work Done</th>
                  <th>Technician</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {c.serviceRecords.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <Link
                        className="link"
                        href={`/service-history/${service.id}`}
                      >
                        {service.serviceNumber}
                      </Link>
                    </td>
                    <td>{date(service.serviceDate)}</td>
                    <td>
                      {service.equipment?.name ||
                        service.equipmentNameSnapshot ||
                        "Not selected"}
                    </td>
                    <td className="max-w-md">{service.problemFound}</td>
                    <td className="max-w-md whitespace-pre-line">
                      {service.workDone}
                    </td>
                    <td>
                      {service.technicianNameSnapshot ||
                        service.technician?.name ||
                        "Not assigned"}
                    </td>
                    <td className="font-bold text-brand-ink">
                      {money(service.charges)}
                    </td>
                  </tr>
                ))}
                {c.serviceRecords.length === 0 && (
                  <EmptyTableRow
                    colSpan={7}
                    text="No completed service history for this customer yet."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  variant,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  variant: "primary" | "dark" | "light";
}) {
  const style =
    variant === "primary"
      ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
      : variant === "dark"
        ? "bg-brand-ink text-white hover:bg-[#111827]"
        : "border border-brand-border bg-white text-brand-primary hover:bg-brand-soft";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${style}`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-primary">
          <Icon size={22} />
        </div>
        <div className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-muted">
          Live
        </div>
      </div>
      <div className="mt-4 text-3xl font-bold text-brand-ink">{value}</div>
      <div className="mt-1 text-sm font-bold text-brand-ink">{label}</div>
      <div className="mt-1 text-sm font-semibold text-brand-muted">{hint}</div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-subtle p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-primary shadow-sm">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            {label}
          </div>
          <div className="mt-1 break-words text-sm font-bold leading-6 text-brand-ink">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyTableRow({
  colSpan,
  text,
}: {
  colSpan: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="rounded-2xl border border-dashed border-brand-border bg-brand-subtle px-4 py-6 text-center text-sm font-semibold text-brand-muted">
          {text}
        </div>
      </td>
    </tr>
  );
}



