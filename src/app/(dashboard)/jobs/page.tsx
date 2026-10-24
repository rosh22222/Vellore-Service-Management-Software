import Link from "next/link";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { date } from "@/lib/format";

export default async function JobsPage() {
  const user = await requireUser();
  const where =
    user.role === "TECHNICIAN"
      ? {
          assignments: {
            some: {
              technicianId: user.technicianId ?? "__none__",
              isActive: true,
            },
          },
          status: {
            notIn: [
              ServiceStatus.SERVICE_COMPLETED,
              ServiceStatus.CLOSED,
              ServiceStatus.CANCELLED,
            ],
          },
        }
      : {
          status: {
            notIn: [
              ServiceStatus.SERVICE_COMPLETED,
              ServiceStatus.CLOSED,
              ServiceStatus.CANCELLED,
            ],
          },
        };
  const rows = await db.serviceComplaint.findMany({
    where,
    include: {
      customer: true,
      equipment: true,
      assignments: {
        where: { isActive: true },
        include: { technician: true },
        orderBy: { assignedAt: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { complaintDate: "asc" }],
    take: 100,
  });
  return (
    <>
      <PageHeader
        title={user.role === "TECHNICIAN" ? "My Assigned Jobs" : "Active Jobs"}
        description="Open a job to view the customer complaint, previous equipment history, inspection, work and parts."
      />
      {rows.length ? (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Customer</th>
                  <th>Equipment</th>
                  <th>Reported Problem</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="link" href={`/jobs/${c.id}`}>
                        {c.complaintNumber}
                      </Link>
                    </td>
                    <td>
                      <div className="font-semibold">{c.customer.name}</div>
                      <div className="text-xs text-brand-muted">
                        {c.customer.primaryMobile}
                      </div>
                    </td>
                    <td>
                      {c.equipment?.name ?? "—"}
                      <div className="text-xs text-brand-muted">
                        {c.equipment?.modelNumber ?? ""}
                      </div>
                    </td>
                    <td className="max-w-sm">{c.customerComplaint}</td>
                    <td>
                      <Badge value={c.priority} />
                    </td>
                    <td>
                      <Badge value={c.status} />
                    </td>
                    <td>
                      {c.assignments.length
                        ? c.assignments.map((assignment) => assignment.technician.name).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No active jobs"
          text="There are currently no jobs assigned to you."
        />
      )}
    </>
  );
}
