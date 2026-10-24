import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { completeServiceFromForm } from "@/actions/complaint";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { date } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";

export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
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
  const history = c.equipmentId
    ? await db.serviceRecord.findMany({
        where: { equipmentId: c.equipmentId },
        include: { technician: true },
        orderBy: { serviceDate: "desc" },
        take: 10,
      })
    : [];
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
      {!complete && (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Complete Service"
              subtitle={`Assigned team: ${activeAssignments.map((assignment) => assignment.technician.name).join(", ")}`}
            />
            <CardBody>
              <ActionForm action={completeServiceFromForm} className="grid gap-5 md:grid-cols-2">
                <input type="hidden" name="complaintId" value={c.id} />
                <div className="md:col-span-2">
                  <Field
                    label="Customer Complaint / Problem Reported"
                    hint="Copied from the office complaint for reference while completing the job."
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
                  The office can record payment later from <b>Service Collections</b>.
                </div>
                <Button variant="success" className="md:col-span-2 md:justify-self-start">
                  Complete Service
                </Button>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}


