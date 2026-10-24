import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { assignTechnicianFromForm } from "@/actions/complaint";
import { deleteTechnicianFromForm } from "@/actions/technician";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { date } from "@/lib/format";

type TechnicianStatsRow = {
  technicianId: string;
  today: number;
  pending: number;
  inProgress: number;
  totalCompleted: number;
};

export default async function TeamsPage() {
  const current = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const canAssign =
    current.role === "ADMIN" || current.canAssignTechnician === true;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [complaints, technicians, statsRows] = await Promise.all([
    canAssign
      ? db.serviceComplaint.findMany({
          where: { status: ServiceStatus.UNASSIGNED },
          include: { customer: true, equipment: true },
          orderBy: [{ priority: "desc" }, { complaintDate: "asc" }],
          take: 100,
        })
      : Promise.resolve([]),
    db.technician.findMany({
      orderBy: { name: "asc" },
    }),
    db.$queryRaw<TechnicianStatsRow[]>`SELECT
      t."id" AS "technicianId",
      (SELECT count(*)::int FROM "ServiceAssignment" a WHERE a."technicianId" = t."id" AND a."assignedAt" >= ${start} AND a."assignedAt" < ${end}) AS "today",
      (SELECT count(*)::int FROM "ServiceComplaint" c WHERE c."status" NOT IN ('SERVICE_COMPLETED','CLOSED','CANCELLED') AND EXISTS (SELECT 1 FROM "ServiceAssignment" a WHERE a."complaintId" = c."id" AND a."technicianId" = t."id" AND a."isActive" = true)) AS "pending",
      (SELECT count(*)::int FROM "ServiceComplaint" c WHERE c."status" IN ('TECHNICIAN_VISITING','INSPECTION_STARTED','PROBLEM_DIAGNOSED','REPAIR_IN_PROGRESS') AND EXISTS (SELECT 1 FROM "ServiceAssignment" a WHERE a."complaintId" = c."id" AND a."technicianId" = t."id" AND a."isActive" = true)) AS "inProgress",
      (SELECT count(*)::int
       FROM "ServiceRecord" s
       WHERE s."technicianId" = t."id"
          OR EXISTS (
            SELECT 1
            FROM "ServiceAssignment" a
            WHERE a."complaintId" = s."complaintId"
              AND a."technicianId" = t."id"
              AND a."endedReason" = 'Service completed'
          )) AS "totalCompleted"
    FROM "Technician" t`,
  ]);
  const statsByTechnician = new Map(
    statsRows.map((row) => [row.technicianId, row]),
  );
  const technicianStats = technicians.map((technician) => ({
    ...technician,
    today: statsByTechnician.get(technician.id)?.today ?? 0,
    pending: statsByTechnician.get(technician.id)?.pending ?? 0,
    inProgress: statsByTechnician.get(technician.id)?.inProgress ?? 0,
    totalCompleted: statsByTechnician.get(technician.id)?.totalCompleted ?? 0,
  }));

  const assignableTechnicians = technicianStats.filter(
    (technician) =>
      technician.isActive &&
      technician.status !== "INACTIVE" &&
      technician.status !== "ON_LEAVE",
  );

  return (
    <>
      <PageHeader
        title="Teams"
        description="Assign service complaints first, then manage technician profiles and login access below."
        actions={
          current.role === "ADMIN" ? (
            <Link
              href="/technicians/new"
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              + Add Technician
            </Link>
          ) : undefined
        }
      />

      <section className="scroll-mt-24" id="technician-assignment">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            Technician Assignment
          </p>
          <h2 className="mt-1 text-2xl font-bold text-brand-ink">
            Assign pending service complaints
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            Use this section daily when new complaints are waiting for a
            technician.
          </p>
        </div>

        {!canAssign ? (
          <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-800">
            Your account does not have technician assignment permission.
          </div>
        ) : (
          <div>
            <Card>
              <CardHeader
                title={`Unassigned Complaints (${complaints.length})`}
                subtitle="Select a technician directly from each complaint card."
              />
              <CardBody className="space-y-4">
                {complaints.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-5 text-sm font-medium text-emerald-800">
                    No unassigned complaints.
                  </div>
                ) : (
                  complaints.map((complaint) => (
                    <div
                      key={complaint.id}
                      className="rounded-2xl border border-brand-border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            className="text-base font-bold hover:underline"
                            href={`/complaints/${complaint.id}`}
                          >
                            {complaint.complaintNumber}
                          </Link>
                          <div className="mt-1 text-sm font-semibold text-brand-secondary">
                            {complaint.customer.name} -{" "}
                            {complaint.equipment?.name ??
                              "Equipment not selected"}
                            {complaint.equipment?.modelNumber
                              ? ` - ${complaint.equipment.modelNumber}`
                              : ""}
                          </div>
                        </div>
                        <Badge value={complaint.priority} />
                      </div>
                      <p className="mt-3 rounded-xl bg-brand-subtle p-3 text-sm text-brand-secondary">
                        {complaint.customerComplaint}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-brand-muted">
                        <span>{complaint.customer.city}</span>
                        <span>{complaint.customer.primaryMobile}</span>
                        <span>{date(complaint.complaintDate, true)}</span>
                      </div>
                      <ActionForm
                        action={assignTechnicianFromForm}
                        className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
                      >
                        <input
                          type="hidden"
                          name="complaintId"
                          value={complaint.id}
                        />
                        <Field label="Technician" required>
                          <Select name="technicianId" required defaultValue="">
                            <option value="">Choose technician</option>
                            {assignableTechnicians.map((technician) => (
                              <option key={technician.id} value={technician.id}>
                                {technician.name} - {technician.status} -{" "}
                                {technician.pending} pending
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Button className="self-end" loadingText="Assigning...">
                          Assign
                        </Button>
                      </ActionForm>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

          </div>
        )}
      </section>

      <section className="mt-8 scroll-mt-24" id="team-management">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            Team Management
          </p>
          <h2 className="mt-1 text-2xl font-bold text-brand-ink">
            Technician profiles and login access
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            This is used only when adding, editing or removing a technician.
          </p>
        </div>

        <Card>
          <CardHeader
            title="Service Technicians"
            subtitle="Each technician has a profile and login to update assigned service work."
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Mobile</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Today</th>
                  <th style={{ textAlign: "center" }}>Progress</th>
                  <th style={{ textAlign: "center" }}>Pending Jobs</th>
                  <th style={{ textAlign: "center" }}>Total Services</th>
                  {current.role === "ADMIN" && (
                    <th style={{ textAlign: "center" }}>Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {technicianStats.map((technician) => (
                  <tr key={technician.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-border bg-brand-faint text-sm font-bold text-brand-primary">
                          {technician.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={technician.photoUrl} alt="" className="h-full w-full object-cover" />
                          ) : technician.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            className="link"
                            href={`/technicians/${technician.id}`}
                          >
                            {technician.name}
                          </Link>
                          <div className="text-xs text-brand-muted">
                            {technician.technicianCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{technician.mobile}</td>
                    <td>{technician.specialization ?? "—"}</td>
                    <td>
                      <Badge value={technician.status} />
                    </td>
                    <td className="text-center">{technician.today}</td>
                    <td className="text-center">{technician.inProgress}</td>
                    <td className="text-center">{technician.pending}</td>
                    <td className="text-center">{technician.totalCompleted}</td>
                    {current.role === "ADMIN" && (
                      <td className="text-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Link
                            href={`/technicians/${technician.id}/edit`}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                          >
                            Edit
                          </Link>
                          <ActionForm action={deleteTechnicianFromForm}>
                            <input
                              type="hidden"
                              name="technicianId"
                              value={technician.id}
                            />
                            <ConfirmSubmitButton
                              message={`Delete technician ${technician.name}? This works only if they have no jobs, assignments, service history or collections.`}
                              className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                              loadingText="Deleting..."
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </ActionForm>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {!technicianStats.length && (
              <div className="px-5 py-10 text-center text-sm text-brand-muted">
                No technicians added yet. Click <b>+ Add Technician</b> to
                create a technician profile and login.
              </div>
            )}
          </div>
        </Card>
      </section>
    </>
  );
}


