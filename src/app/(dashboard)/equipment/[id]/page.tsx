import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { date, money } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";

export default async function EquipmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const { updated } = await searchParams;
  const e = await db.customerEquipment.findUnique({
    where: { id },
    include: {
      customer: true,
      complaints: {
        where: {
          status: {
            notIn: [
              ServiceStatus.SERVICE_COMPLETED,
              ServiceStatus.CLOSED,
              ServiceStatus.CANCELLED,
            ],
          },
        },
        include: { currentTechnician: true },
        orderBy: { complaintDate: "desc" },
      },
      serviceRecords: {
        include: { technician: true, parts: true },
        orderBy: { serviceDate: "desc" },
      },
      billDetailItems: {
        include: { billDetail: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      billDetailUnits: { include: { billDetailItem: { include: { billDetail: true } } } },
    },
  });
  if (!e) notFound();
  const linkedBillItems = [...new Map([...e.billDetailItems, ...e.billDetailUnits.map(unit => unit.billDetailItem)].map(item => [item.id, item])).values()];
  const w = warrantyStatus(e.warrantyExpiryDate);
  return (
    <>
      <PageHeader
        title={`${e.name}${e.modelNumber ? ` • ${e.modelNumber}` : ""}`}
        description={`${e.equipmentCode} • ${e.customer.name}`}
        actions={
          <>
            <Link
              href={`/equipment/${e.id}/edit`}
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Edit
            </Link>
            <Link
              href={`/complaints/new?customerId=${e.customerId}&equipmentId=${e.id}`}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              + New Complaint
            </Link>
          </>
        }
      />
      {updated === "1" && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-semibold">Equipment updated successfully.</div>
          <div className="mt-1">
            Linked Bill Details and service screens now use the latest product
            information.
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Equipment Details" />
          <CardBody className="grid grid-cols-2 gap-5">
            <div>
              <div className="label">Customer</div>
              <div className="value">
                <Link className="link" href={`/customers/${e.customerId}`}>
                  {e.customer.name}
                </Link>
              </div>
            </div>
            <div>
              <div className="label">Brand</div>
              <div className="value">{e.brand ?? "—"}</div>
            </div>
            <div>
              <div className="label">Model</div>
              <div className="value">{e.modelNumber ?? "—"}</div>
            </div>
            <div>
              <div className="label">Serial</div>
              <div className="value">{e.serialNumber ?? "—"}</div>
            </div>
            <div>
              <div className="label">Installation</div>
              <div className="value">{date(e.installationDate)}</div>
            </div>
            <div>
              <div className="label">Warranty</div>
              <div className="value">
                <Badge value={w} />
              </div>
            </div>
            <div>
              <div className="label">Warranty Expiry</div>
              <div className="value">{date(e.warrantyExpiryDate)}</div>
            </div>
            <div className="col-span-2">
              <div className="label">Stored Bill Reference</div>
              <div className="value">
                {linkedBillItems.length ? (
                  linkedBillItems.map((item) => (
                    <Link
                      key={item.id}
                      className="link mr-3"
                      href={`/bill-details/${item.billDetailId}`}
                    >
                      {item.billDetail.billNumber}
                    </Link>
                  ))
                ) : (
                  e.invoiceNumber ?? "—"
                )}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Open Complaints" />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Problem</th>
                  <th>Tech</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {e.complaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="link" href={`/complaints/${c.id}`}>
                        {c.complaintNumber}
                      </Link>
                      <div className="text-xs text-brand-muted">
                        {date(c.complaintDate)}
                      </div>
                    </td>
                    <td>{c.customerComplaint}</td>
                    <td>{c.currentTechnician?.name ?? "—"}</td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                  </tr>
                ))}
                {e.complaints.length === 0 && (
                  <tr>
                    <td colSpan={4}>No open complaints for this equipment.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader
          title="Equipment Service Timeline"
          subtitle="Chronological life history of this machine"
        />
        <CardBody>
          <div className="space-y-0">
            <div className="relative border-l-2 border-brand-border pb-8 pl-6">
              <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand-ink" />
              <div className="font-semibold">Installed</div>
              <div className="text-sm text-brand-muted">
                {date(e.installationDate)}
              </div>
            </div>
            {e.serviceRecords
              .slice()
              .reverse()
              .map((s, idx) => (
                <div
                  key={s.id}
                  className="relative border-l-2 border-brand-border pb-8 pl-6 last:border-transparent"
                >
                  <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand-primary ring-4 ring-white" />
                  <Link
                    href={`/service-history/${s.id}`}
                    className="font-semibold hover:underline"
                  >
                    {s.serviceNumber}
                  </Link>
                  <div className="text-sm text-brand-muted">
                    {date(s.serviceDate)} • {s.problemFound}
                  </div>
                  <div className="mt-1 text-sm text-brand-secondary">
                    {s.workDone}
                  </div>
                </div>
              ))}
          </div>
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Service Parts / Technicians / Charges" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Technician</th>
                <th>Parts</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {e.serviceRecords.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link className="link" href={`/service-history/${s.id}`}>
                      {s.serviceNumber}
                    </Link>
                  </td>
                  <td>
                    {s.technicianNameSnapshot ?? s.technician?.name ?? "—"}
                  </td>
                  <td>{s.partsSummary}</td>
                  <td>{money(s.charges)}</td>
                </tr>
              ))}
              {e.serviceRecords.length === 0 && (
                <tr>
                  <td colSpan={4}>No completed service records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}


