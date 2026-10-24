import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma, ServiceStatus, TechnicianStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import {
  deleteTechnicianFromForm,
  setTechnicianStatus,
} from "@/actions/technician";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { date, titleCase } from "@/lib/format";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";

export default async function TechnicianDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const currentUser = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const { updated } = await searchParams;
  const t = await db.technician.findUnique({
    where: { id },
    include: {
      assignments: {
        where: {
          isActive: true,
          complaint: {
            status: {
              notIn: [
                ServiceStatus.SERVICE_COMPLETED,
                ServiceStatus.CLOSED,
                ServiceStatus.CANCELLED,
              ],
            },
          },
        },
        include: {
          complaint: { include: { customer: true, equipment: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
      user: true,
    },
  });
  if (!t) notFound();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const completedServiceWhere = {
    OR: [
      { technicianId: id },
      {
        complaint: {
          assignments: {
            some: { technicianId: id, endedReason: "Service completed" },
          },
        },
      },
    ],
  } satisfies Prisma.ServiceRecordWhereInput;
  const [today, done, serviceTotal, serviceRecords] = await Promise.all([
    db.serviceAssignment.count({
      where: { technicianId: id, assignedAt: { gte: start } },
    }),
    db.serviceRecord.count({
      where: { AND: [completedServiceWhere, { serviceDate: { gte: start } }] },
    }),
    db.serviceRecord.count({ where: completedServiceWhere }),
    db.serviceRecord.findMany({
      where: completedServiceWhere,
      include: { customer: true, equipment: true },
      orderBy: { serviceDate: "desc" },
      take: 20,
    }),
  ]);
  return (
    <>
      <PageHeader
        title={t.name}
        description={`${t.technicianCode} • ${t.mobile}`}
        actions={
          <>
            <Badge value={t.status} />
            {currentUser.role === "ADMIN" && (
              <>
                <Link
                  href={`/technicians/${t.id}/edit`}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Edit Technician
                </Link>
                <ActionForm action={deleteTechnicianFromForm}>
                  <input type="hidden" name="technicianId" value={t.id} />
                  <ConfirmSubmitButton
                    message={`Delete technician ${t.name}? This works only if they have no jobs, assignments, service history or collections.`}
                    className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    loadingText="Deleting..."
                  >
                    Delete Technician
                  </ConfirmSubmitButton>
                </ActionForm>
              </>
            )}
          </>
        }
      />
      {updated === "1" && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
          Technician profile and linked login details updated successfully.
        </AutoDismissNotice>
      )}
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-faint/60 p-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-border bg-white text-2xl font-bold text-brand-primary shadow-sm">
                {t.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.photoUrl} alt={t.name} className="h-full w-full object-cover" />
                ) : t.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-brand-ink">{t.name}</div>
                <div className="text-sm text-brand-muted">{t.technicianCode}</div>
              </div>
            </div>
            <div>
              <div className="label">Specialization</div>
              <div className="value">{t.specialization ?? "—"}</div>
            </div>
            <div>
              <div className="label">Login</div>
              <div className="value">{t.user?.username ?? "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-brand-subtle p-4 text-center sm:grid-cols-4">
              <div>
                <b className="text-xl">{today}</b>
                <div className="text-xs text-brand-muted">Today</div>
              </div>
              <div>
                <b className="text-xl">{t.assignments.length}</b>
                <div className="text-xs text-brand-muted">Pending</div>
              </div>
              <div>
                <b className="text-xl">{done}</b>
                <div className="text-xs text-brand-muted">Done Today</div>
              </div>
              <div>
                <b className="text-xl">{serviceTotal}</b>
                <div className="text-xs text-brand-muted">Total Services</div>
              </div>
            </div>
            {currentUser.role === "ADMIN" && (
              <ActionForm
                action={setTechnicianStatus.bind(null, t.id)}
                className="flex gap-2"
              >
                <select
                  name="status"
                  defaultValue={t.status}
                  className="flex-1 rounded-xl border border-brand-border px-3 py-2 text-sm"
                >
                  {Object.values(TechnicianStatus).map((v) => (
                    <option key={v} value={v}>
                      {titleCase(v)}
                    </option>
                  ))}
                </select>
                <Button className="px-4" loadingText="Updating...">
                  Update
                </Button>
              </ActionForm>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Current Jobs" />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Customer</th>
                  <th>Equipment</th>
                  <th>Problem</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {t.assignments.map(({ complaint: c }) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="link" href={`/complaints/${c.id}`}>
                        {c.complaintNumber}
                      </Link>
                    </td>
                    <td>{c.customer.name}</td>
                    <td>{c.equipment?.name ?? "—"}</td>
                    <td>{c.customerComplaint}</td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent Completed Services" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Equipment</th>
                <th>Problem Found</th>
              </tr>
            </thead>
            <tbody>
              {serviceRecords.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link className="link" href={`/service-history/${s.id}`}>
                      {s.serviceNumber}
                    </Link>
                  </td>
                  <td>{date(s.serviceDate)}</td>
                  <td>{s.customer.name}</td>
                  <td>{s.equipment?.name ?? s.equipmentNameSnapshot ?? "—"}</td>
                  <td>{s.problemFound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}


