import { ComplaintEquipmentWorkspace } from "@/components/complaint-equipment-workspace";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { date } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";
import { getCachedActiveBrands } from "@/lib/cached-lookups";

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    equipmentAdded?: string;
    equipmentUpdated?: string;
    equipmentCompleted?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const addedCount = Math.max(
    0,
    Math.min(25, Number.parseInt(query.equipmentAdded ?? "0", 10) || 0),
  );
  if (user.role !== "TECHNICIAN") redirect(`/complaints/${id}`);
  const c = await db.serviceComplaint.findUnique({
    where: { id },
    include: {
      customer: true,
      equipment: true,
      currentTechnician: true,
      inspection: true,
      workLogs: { include: { createdBy: true }, orderBy: { createdAt: "asc" } },
      statusHistory: {
        include: { changedBy: true },
        orderBy: { changedAt: "desc" },
      },
      serviceRecord: true,
      assignments: {
        include: { technician: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  if (!c) notFound();
  const activeAssignments = c.assignments.filter((assignment) => assignment.isActive);
  const hasActiveAssignment = activeAssignments.some(
    (assignment) => assignment.technicianId === user.technicianId,
  );
  if (c.serviceRecord) {
    const receivedCompletionCredit =
      c.serviceRecord.technicianId === user.technicianId ||
      c.assignments.some(
        (assignment) =>
          assignment.technicianId === user.technicianId &&
          assignment.endedReason === "Service completed",
      );
    if (!receivedCompletionCredit) notFound();
    redirect(`/service-history/${c.serviceRecord.id}`);
  }
  if (!hasActiveAssignment) notFound();
  const [history, customerEquipment, brands, visitServices] = await Promise.all([
    c.equipmentId
      ? db.serviceRecord.findMany({
          where: { equipmentId: c.equipmentId },
          include: { technician: true },
          orderBy: { serviceDate: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    db.customerEquipment.findMany({
      where: { customerId: c.customerId },
      orderBy: [{ name: "asc" }, { modelNumber: "asc" }],
    }),
    getCachedActiveBrands(),
    db.serviceComplaint.findMany({
      where: c.serviceVisitGroupId
        ? { serviceVisitGroupId: c.serviceVisitGroupId }
        : { id: c.id },
      select: {
        id: true,
        complaintNumber: true,
        customerComplaint: true,
        status: true,
        equipment: {
          select: {
            name: true,
            brand: true,
            modelNumber: true,
            serialNumber: true,
            notes: true,
          },
        },
        inspection: { select: { actualProblem: true } },
        workLogs: {
          select: { workDone: true },
          orderBy: { createdAt: "asc" },
        },
        assignments: {
          where: { isActive: true },
          select: { id: true },
        },
        serviceRecord: {
          select: { id: true, serviceNumber: true, charges: true },
        },
      },
      orderBy: [{ complaintDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const complete = Boolean(c.serviceRecord) || c.status === "CLOSED" || c.status === "CANCELLED";
  const w = warrantyStatus(c.equipment?.warrantyExpiryDate);
  return (
    <>
      <PageHeader
        title={`Job • ${c.complaintNumber}`}
        description={`${c.customer.name} • ${c.customer.primaryMobile}`}
        actions={
          <>
            <Badge value={c.priority} />
            <Badge value={c.status} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Customer Details" />
          <CardBody className="grid grid-cols-2 gap-4">
            <div>
              <div className="label">Name</div>
              <div className="value font-semibold">{c.customer.name}</div>
            </div>
            <div>
              <div className="label">Phone</div>
              <div className="value font-semibold">
                {c.customer.primaryMobile}
              </div>
            </div>
            <div className="col-span-2">
              <div className="label">Address / Location</div>
              <div className="value">
                {c.customer.address}, {c.customer.city}, {c.customer.state}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Equipment Details" />
          <CardBody className="grid grid-cols-2 gap-4">
            <div>
              <div className="label">Equipment</div>
              <div className="value font-semibold">
                {c.equipment?.name ?? "Not linked"}
              </div>
              {c.equipment && <div className="mt-1 text-xs font-medium text-brand-primary">{c.equipment.equipmentCode}</div>}
            </div>
            <div>
              <div className="label">Brand</div>
              <div className="value">{c.equipment?.brand ?? "—"}</div>
            </div>
            <div>
              <div className="label">Model</div>
              <div className="value">{c.equipment?.modelNumber ?? "—"}</div>
            </div>
            <div>
              <div className="label">Serial</div>
              <div className="value">{c.equipment?.serialNumber ?? "—"}</div>
            </div>
            <div>
              <div className="label">Warranty</div>
              <div className="value">
                <Badge value={w} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      {!complete && (
        <ComplaintEquipmentWorkspace
          complaintId={c.id}
          equipment={customerEquipment}
          brands={brands}
          currentEquipmentId={c.equipmentId}
          visitServices={visitServices}
          addedCount={addedCount}
          equipmentUpdated={query.equipmentUpdated === "1"}
          equipmentCompleted={query.equipmentCompleted === "1"}
        />
      )}
      <Card className="mt-6">
        <CardHeader
          title="Customer Complaint"
          subtitle="What the customer told the office — do not rewrite this as the diagnosis."
        />
        <CardBody>
          <div className="rounded-2xl bg-brand-primary p-6 text-xl font-medium leading-8 text-white">
            “{c.customerComplaint}”
          </div>
          {c.notes && <div className="mt-4 rounded-xl border border-brand-border bg-brand-faint p-4"><p className="text-xs font-semibold text-brand-primary">Office Notes</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-secondary">{c.notes}</p></div>}
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader
          title="Previous Service History — Review Before Service"
          subtitle="Complete history for this exact equipment."
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Previous Complaint</th>
                <th>Problem Found</th>
                <th>Work Done</th>
                <th>Technician</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link className="link" href={`/service-history/${s.id}`}>
                      {s.serviceNumber}
                    </Link>
                  </td>
                  <td>{date(s.serviceDate)}</td>
                  <td>{s.complaintReported}</td>
                  <td>{s.problemFound}</td>
                  <td>{s.workDone}</td>
                  <td>
                    {s.technicianNameSnapshot ?? s.technician?.name ?? "—"}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    No previous completed service for this equipment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}


