import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentMode, ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  saveInspectionFromForm,
  addWorkLogFromForm,
  updateServiceStatusFromForm,
  completeServiceFromForm,
} from "@/actions/complaint";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { date, titleCase } from "@/lib/format";
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
    },
  });
  if (!c) notFound();
  if (c.currentTechnicianId !== user.technicianId)
    throw new Error("This job is not assigned to you.");
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
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Inspection & Diagnosis" />
            <CardBody>
              <ActionForm action={saveInspectionFromForm} className="space-y-4">
                <input type="hidden" name="complaintId" value={c.id} />
                <Field label="Inspection Findings" required>
                  <Textarea
                    name="findings"
                    required
                    defaultValue={c.inspection?.findings ?? ""}
                    placeholder="Drive belt loose and motor belt alignment incorrect."
                  />
                </Field>
                <Field label="Actual Problem Found" required>
                  <Textarea
                    name="actualProblem"
                    required
                    defaultValue={c.inspection?.actualProblem ?? ""}
                    placeholder="Drive belt loose."
                  />
                </Field>
                <Button>Save Diagnosis</Button>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Work Performed" />
            <CardBody>
              {c.workLogs.map((w) => (
                <div key={w.id} className="mb-3 rounded-xl bg-brand-subtle p-4">
                  <div className="whitespace-pre-line font-medium">
                    {w.workDone}
                  </div>
                  <div className="mt-2 text-xs text-brand-muted">
                    {date(w.createdAt, true)}
                  </div>
                </div>
              ))}
              <ActionForm action={addWorkLogFromForm} className="space-y-4">
                <input type="hidden" name="complaintId" value={c.id} />
                <Field label="Work Done" required>
                  <Textarea
                    name="workDone"
                    required
                    placeholder="Drive belt tightened; motor belt aligned; lubrication completed; machine tested."
                  />
                </Field>
                <Field label="Notes">
                  <Input name="notes" />
                </Field>
                <Button>Add Work</Button>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      )}
      {!complete && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader title="Service Status" />
            <CardBody>
              <ActionForm action={updateServiceStatusFromForm} className="space-y-3">
                <input type="hidden" name="complaintId" value={c.id} />
                <Select name="status" defaultValue={c.status}>
                  {Object.values(ServiceStatus)
                    .filter(
                      (v) =>
                        !["SERVICE_COMPLETED", "CLOSED", "CANCELLED"].includes(
                          v,
                        ) && v !== ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL,
                    )
                    .map((v) => (
                      <option value={v} key={v}>
                        {titleCase(v)}
                      </option>
                    ))}
                </Select>
                <Input name="notes" placeholder="Status note" />
                <Button>Update</Button>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Complete Service" />
            <CardBody>
              <ActionForm action={completeServiceFromForm} className="space-y-3">
                <input type="hidden" name="complaintId" value={c.id} />
                <Field label="Completion Notes" required>
                  <Textarea
                    name="completionNotes"
                    required
                    placeholder="Testing / handover notes"
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
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </Field>
                <Field
                  label="Collected Now"
                  hint="Enter 0 if customer will pay later."
                >
                  <Input
                    name="collectedNow"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                  />
                </Field>
                <Field label="Payment Mode">
                  <Select name="paymentMode" defaultValue={PaymentMode.CASH}>
                    {Object.values(PaymentMode).map((mode) => (
                      <option key={mode} value={mode}>
                        {titleCase(mode)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="success" className="w-full">
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


