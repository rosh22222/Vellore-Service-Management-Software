import { ActionForm } from "@/components/action-form";
import { ComplaintEquipmentWorkspace } from "@/components/complaint-equipment-workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import {
  assignTechnicianFromForm,
  unassignTechnicianFromForm,
} from "@/actions/complaint";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { date, titleCase } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";
import {
  getCachedActiveBrands,
  getCachedTechnicianOptions,
} from "@/lib/cached-lookups";

export default async function ComplaintDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    equipmentAdded?: string;
    equipmentUpdated?: string;
    equipmentDeleted?: string;
    equipmentCompleted?: string;
    visitCompleted?: string;
  }>;
}) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const query = await searchParams;
  const addedCount = Math.max(
    0,
    Math.min(25, Number.parseInt(query.equipmentAdded ?? "0", 10) || 0),
  );
  const [c, technicians, brands] = await Promise.all([
    db.serviceComplaint.findUnique({
      where: { id },
      include: {
        customer: true,
        equipment: true,
        currentTechnician: true,
        createdBy: true,
        assignments: {
          include: { technician: true, assignedBy: true },
          orderBy: { assignedAt: "desc" },
        },
        inspection: true,
        workLogs: {
          include: { createdBy: true },
          orderBy: { createdAt: "asc" },
        },
        statusHistory: {
          include: { changedBy: true },
          orderBy: { changedAt: "desc" },
        },
        serviceRecord: true,
      },
    }),
    getCachedTechnicianOptions(),
    getCachedActiveBrands(),
  ]);
  if (!c) notFound();
  const complete = Boolean(c.serviceRecord) || c.status === "CLOSED" || c.status === "CANCELLED";
  const [customerEquipment, visitServices] = await Promise.all([
    complete
      ? Promise.resolve([])
      : db.customerEquipment.findMany({
        where: { customerId: c.customerId },
        orderBy: [{ name: "asc" }, { modelNumber: "asc" }],
      }),
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
          select: { id: true, serviceNumber: true },
        },
      },
      orderBy: [{ complaintDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const w = warrantyStatus(
    c.equipment?.warrantyExpiryDate,
    c.serviceRecord?.serviceDate ?? new Date(),
  );
  const canAssign = user.role === "ADMIN" || user.canAssignTechnician;
  const assignedTechnicianIds = new Set(
    c.assignments
      .filter((assignment) => assignment.isActive)
      .map((assignment) => assignment.technicianId),
  );
  const activeTechnicians = technicians.filter(
    (technician) =>
      technician.status !== "INACTIVE" &&
      technician.status !== "ON_LEAVE" &&
      !assignedTechnicianIds.has(technician.id),
  );
  const assignmentSummary = summarizeAssignments(c.assignments);
  const activeAssignments = c.assignments.filter(
    (assignment) => assignment.isActive,
  );
  const completedTechnicians = c.serviceRecord
    ? c.serviceRecord.technicianNameSnapshot?.trim() ||
      Array.from(
        new Set(
          c.assignments
            .filter(
              (assignment) => assignment.endedReason === "Service completed",
            )
            .map((assignment) => assignment.technician.name),
        ),
      ).join(" & ") ||
      c.currentTechnician?.name ||
      "Not recorded"
    : null;
  return (
    <>
      <PageHeader
        title={c.complaintNumber}
        description={`${c.customer.name} • ${date(c.complaintDate, true)}`}
        actions={
          <>
            <Badge value={c.priority} />
            <Badge value={c.status} />
            {c.serviceRecord && (
              <Link
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                href={`/service-history/${c.serviceRecord.id}`}
              >
                View Permanent Record
              </Link>
            )}
          </>
        }
      />
      {c.repeatIssueDetected && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Repeat problem indicator:</strong> Similar wording was found
          in this equipment's previous service history. Review the machine
          timeline before diagnosis.
          {c.repeatReferenceServiceId && (
            <>
              {" "}
              <Link
                className="font-semibold underline"
                href={`/service-history/${c.repeatReferenceServiceId}`}
              >
                Open similar previous service
              </Link>
              .
            </>
          )}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader title="Customer & Equipment" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="label">Customer</div>
              <div className="value">
                <Link className="link" href={`/customers/${c.customerId}`}>
                  {c.customer.name}
                </Link>
              </div>
            </div>
            <div>
              <div className="label">Phone</div>
              <div className="value font-semibold">
                {c.customer.primaryMobile}
              </div>
            </div>
            <div>
              <div className="label">Address</div>
              <div className="value">
                {c.customer.address}, {c.customer.city}
              </div>
            </div>
            <div>
              <div className="label">Equipment</div>
              {c.equipment && <p className="mb-1 text-xs font-semibold text-brand-primary">{c.equipment.equipmentCode}</p>}
              <div className="value">
                {c.equipment ? (
                  <div>
                    <Link className="link" href={`/equipment/${c.equipment.id}`}>
                    {c.equipment.name}{" "}
                    {c.equipment.modelNumber
                      ? `• ${c.equipment.modelNumber}`
                      : ""}
                    </Link>
                  </div>
                ) : (
                  "Not linked"
                )}
              </div>
            </div>
            <div>
              <div className="label">Serial Number</div>
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
        <Card>
          <CardHeader title="Customer Complaint" />
          <CardBody>
            {c.notes && <div className="mb-4 rounded-xl border border-brand-border bg-brand-faint p-4"><p className="text-xs font-semibold text-brand-primary">Office Notes</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-secondary">{c.notes}</p></div>}
            <div className="rounded-2xl bg-brand-primary p-5 text-lg font-medium leading-8 text-white">
              “{c.customerComplaint}”
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="label">Problem Type</div>
                <div className="value">{c.complaintCategory ?? "—"}</div>
              </div>
              <div>
                <div className="label">Source</div>
                <div className="value">{titleCase(c.source)}</div>
              </div>
              <div>
                <div className="label">Preferred Visit</div>
                <div className="value">{date(c.preferredVisitDate)}</div>
              </div>
              <div>
                <div className="label">Created By</div>
                <div className="value">{c.createdBy.name}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {c.serviceRecord && (
        <Card className="mt-6 border-brand-accent/70">
          <CardHeader
            title="Service Completion"
            subtitle="Final service details and the technicians credited for this work."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-brand-accent/45 bg-brand-faint p-4 sm:col-span-2 xl:col-span-1">
              <div className="label">Technician(s) Who Worked on This Service</div>
              <div className="mt-2 text-lg font-bold text-brand-primary">
                {completedTechnicians}
              </div>
            </div>
            <div className="rounded-xl bg-brand-subtle p-4">
              <div className="label">Service Completed On</div>
              <div className="value">{date(c.serviceRecord.serviceDate, true)}</div>
            </div>
            <div className="rounded-xl bg-brand-subtle p-4">
              <div className="label">Permanent Service Record</div>
              <div className="value">
                <Link
                  className="link font-semibold"
                  href={`/service-history/${c.serviceRecord.id}`}
                >
                  {c.serviceRecord.serviceNumber}
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <ComplaintEquipmentWorkspace
        complaintId={c.id}
        equipment={customerEquipment}
        brands={brands}
        currentEquipmentId={c.equipmentId}
        canAdd={!complete}
        canDelete={!complete}
        visitServices={visitServices}
        addedCount={addedCount}
        equipmentUpdated={query.equipmentUpdated === "1"}
        equipmentDeleted={query.equipmentDeleted === "1"}
        equipmentCompleted={query.equipmentCompleted === "1"}
        visitCompleted={query.visitCompleted === "1"}
      />

      {!complete && canAssign && (
        <Card className="mt-6">
          <CardHeader
            title="Technician Assignment"
            subtitle="Add one or more technicians to work on this service complaint."
          />
          <CardBody>
            <ActionForm
              action={assignTechnicianFromForm}
              className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <input type="hidden" name="complaintId" value={c.id} />
              <Field label="Technician" required>
                <Select
                  name="technicianId"
                  required
                  defaultValue=""
                  disabled={activeTechnicians.length === 0}
                >
                  <option value="">Select technician</option>
                  {activeTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {titleCase(t.status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assignment Note">
                <Input
                  name="reason"
                  placeholder="Optional work or visit instruction"
                />
              </Field>
              <div className="self-end">
                <Button type="submit" disabled={activeTechnicians.length === 0}>
                  Add Technician
                </Button>
              </div>
            </ActionForm>
            {c.assignments.length > 0 && (
              <div className="mt-5 table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th>Assigned By</th>
                      <th>Assigned At</th>
                      <th>Ended</th>
                      <th>Assignment Note</th>
                      <th>Ended Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                        <td className="font-semibold">{assignmentSummary.technicians}</td>
                        <td>{assignmentSummary.assignedBy}</td>
                        <td>{assignmentSummary.assignedAt}</td>
                        <td>{assignmentSummary.endedAt}</td>
                        <td>{assignmentSummary.notes}</td>
                        <td>{assignmentSummary.endedReasons}</td>
                        <td>
                          {activeAssignments.length ? (
                            <div className="flex flex-wrap gap-2">
                              {activeAssignments.map((assignment) => (
                                <ActionForm
                                  key={assignment.id}
                                  action={unassignTechnicianFromForm}
                                >
                                  <input type="hidden" name="complaintId" value={c.id} />
                                  <input type="hidden" name="technicianId" value={assignment.technicianId} />
                                  <Button type="submit" variant="secondary" className="px-3 py-2 text-xs">
                                    Remove {assignment.technician.name}
                                  </Button>
                                </ActionForm>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-brand-muted">History</span>
                          )}
                        </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Activity Timeline"
          subtitle="Every important status change is stored with user, date and time."
        />
        <CardBody>
          <div className="space-y-0">
            {c.statusHistory.map((h) => (
              <div
                key={h.id}
                className="relative border-l-2 border-brand-border pb-7 pl-6 last:border-transparent"
              >
                <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand-ink" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={h.newStatus} />
                  <span className="text-xs text-brand-muted">
                    {date(h.changedAt, true)} • {h.changedBy.name}
                  </span>
                </div>
                {h.notes && (
                  <div className="mt-2 text-sm text-brand-secondary">{h.notes}</div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function summarizeAssignments(
  assignments: Array<{
    technician: { name: string };
    assignedBy: { name: string };
    assignedAt: Date;
    unassignedAt: Date | null;
    reason: string | null;
    endedReason: string | null;
  }>,
) {
  const join = (values: Array<string | null | undefined>, separator = " / ") => {
    const unique = Array.from(
      new Set(values.filter((value): value is string => Boolean(value))),
    );
    return unique.join(separator) || "—";
  };
  return {
    technicians: join(assignments.map((item) => item.technician.name), " & "),
    assignedBy: join(assignments.map((item) => item.assignedBy.name), " & "),
    assignedAt: join(assignments.map((item) => date(item.assignedAt, true))),
    endedAt: join(
      assignments
        .filter((item) => item.unassignedAt)
        .map((item) => date(item.unassignedAt, true)),
    ),
    notes: join(assignments.map((item) => item.reason)),
    endedReasons: join(assignments.map((item) => item.endedReason)),
  };
}


