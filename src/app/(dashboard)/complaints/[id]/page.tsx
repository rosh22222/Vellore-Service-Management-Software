import { ActionForm } from "@/components/action-form";
import { EquipmentSelect } from "@/components/equipment-select";
import { equipmentLabel } from "@/lib/equipment-label";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import {
  assignTechnicianFromForm,
  unassignTechnicianFromForm,
  linkComplaintEquipmentFromForm,
  completeServiceFromForm,
} from "@/actions/complaint";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { date, titleCase } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";
import { getCachedTechnicianOptions } from "@/lib/cached-lookups";

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const [c, technicians] = await Promise.all([
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
  ]);
  if (!c) notFound();
  const complete = Boolean(c.serviceRecord) || c.status === "CLOSED" || c.status === "CANCELLED";
  const customerEquipment = complete
    ? []
    : await db.customerEquipment.findMany({
        where: { customerId: c.customerId },
        orderBy: [{ name: "asc" }, { modelNumber: "asc" }],
      });
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
                  <Link className="link" href={`/equipment/${c.equipment.id}`}>
                    {c.equipment.name}{" "}
                    {c.equipment.modelNumber
                      ? `• ${c.equipment.modelNumber}`
                      : ""}
                  </Link>
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

      {!complete && (
        <Card className="mt-6">
          <CardHeader
            title="Link Equipment"
            subtitle="Use this when complaint was registered before the exact machine details were known."
          />
          <CardBody className="space-y-6">
            <ActionForm
              action={linkComplaintEquipmentFromForm}
              className="grid gap-4 md:grid-cols-[1fr_auto]"
            >
              <input type="hidden" name="complaintId" value={c.id} />
              <input type="hidden" name="equipmentMode" value="existing" />
              <Field label="Existing Customer Equipment" required>
                <EquipmentSelect
                  name="equipmentId"
                  required
                  defaultValue={c.equipmentId ?? ""}
                  disabled={customerEquipment.length === 0}
                  options={customerEquipment.map(item => ({ value: item.id, label: equipmentLabel(item) }))}
                />
              </Field>
              <div className="self-end">
                <Button
                  type="submit"
                  disabled={customerEquipment.length === 0}
                >
                  Link Equipment
                </Button>
              </div>
            </ActionForm>

            {c.equipmentId && (
              <ActionForm action={linkComplaintEquipmentFromForm}>
                <input type="hidden" name="complaintId" value={c.id} />
                <input type="hidden" name="equipmentMode" value="unknown" />
                <Button
                  variant="secondary"
                  loadingText="Updating..."
                >
                  Mark Equipment Not Known
                </Button>
              </ActionForm>
            )}

            <ActionForm
              action={linkComplaintEquipmentFromForm}
              className="grid gap-4 border-t border-brand-border pt-5 md:grid-cols-2 xl:grid-cols-4"
            >
              <input type="hidden" name="complaintId" value={c.id} />
              <input type="hidden" name="equipmentMode" value="new" />
              <div className="md:col-span-2 xl:col-span-4">
                <h3 className="text-sm font-semibold text-brand-ink">
                  Register New Equipment for This Complaint
                </h3>
              </div>
              <Field label="Equipment Name" required>
                <Input name="newEquipmentName" required />
              </Field>
              <Field label="Brand">
                <Input name="newEquipmentBrand" />
              </Field>
              <Field label="Model Number">
                <Input name="newEquipmentModel" />
              </Field>
              <Field label="Serial Number">
                <Input name="newEquipmentSerial" />
              </Field>
              <Field label="Purchase Date">
                <Input name="newEquipmentPurchaseDate" type="date" />
              </Field>
              <Field label="Installation Date">
                <Input name="newEquipmentInstallationDate" type="date" />
              </Field>
              <Field label="Warranty Start">
                <Input name="newEquipmentWarrantyStartDate" type="date" />
              </Field>
              <Field label="Warranty Expiry">
                <Input name="newEquipmentWarrantyExpiryDate" type="date" />
              </Field>
              <Field label="Warranty Duration">
                <Input name="newEquipmentWarrantyDuration" />
              </Field>
              <Field label="Equipment Stored Bill Reference">
                <Input name="newEquipmentInvoice" />
              </Field>
              <div className="md:col-span-2 xl:col-span-4">
                <Field label="Equipment Notes">
                  <Textarea name="newEquipmentNotes" rows={2} />
                </Field>
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <Button type="submit">Register & Link Equipment</Button>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      )}

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

      {!complete && (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Complete Service"
              subtitle="Record what was found, what was done and the final service amount in one step."
            />
            <CardBody>
              <ActionForm action={completeServiceFromForm} className="grid gap-5 md:grid-cols-2">
                <input type="hidden" name="complaintId" value={c.id} />
                <div className="md:col-span-2">
                  <Field
                    label="Customer Complaint / Problem Reported"
                    hint="Copied from complaint registration for technician reference."
                  >
                    <Textarea value={c.customerComplaint} readOnly rows={3} />
                  </Field>
                </div>
                <Field label="Actual Problem Found" required>
                  <Textarea
                    name="actualProblem"
                    required
                    defaultValue={c.inspection?.actualProblem ?? ""}
                    placeholder="Describe the actual fault found during service."
                  />
                </Field>
                <Field label="Work Performed" required>
                  <Textarea
                    name="workDone"
                    required
                    defaultValue={c.workLogs.map((work) => work.workDone).join("\n")}
                    placeholder="Describe the repair or service work completed."
                  />
                </Field>
                <Field
                  label="Service Amount"
                  required
                  hint="Total amount for this service. Enter 0 for warranty/free service."
                >
                  <Input
                    name="charges"
                    required
                    type="text"
                    inputMode="decimal"
                    pattern="\d+(\.\d{1,2})?"
                    title="Enter an amount using numbers with up to two decimal places."
                    defaultValue="0"
                  />
                </Field>
                <div className="self-end rounded-xl border border-brand-border bg-brand-faint p-4 text-sm text-brand-secondary">
                  Payments can be recorded later from <b>Service Collections</b>.
                </div>
                <Button
                  type="submit"
                  variant="success"
                  className="md:col-span-2 md:justify-self-start"
                >
                  Complete & Create Permanent Record
                </Button>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
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


