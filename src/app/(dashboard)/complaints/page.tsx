import { dateInput, dateBoundary } from "@/lib/business-date";
import Link from "next/link";
import { ComplaintPriority, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchForm } from "@/components/ui/search-form";
import { date, titleCase } from "@/lib/format";
import { getCachedTechnicianOptions } from "@/lib/cached-lookups";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";

type Params = {
  q?: string;
  priority?: string;
  technician?: string;
  customer?: string;
  equipment?: string;
  assigned?: string;
  warranty?: string;
  from?: string;
  to?: string;
  page?: string;
  created?: string;
};
const pageSize = 25;
export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const where: Prisma.ServiceComplaintWhereInput = {};

  if (params.q)
    where.OR = [
      { complaintNumber: { contains: params.q, mode: "insensitive" } },
      { customerComplaint: { contains: params.q, mode: "insensitive" } },
      { customer: { name: { contains: params.q, mode: "insensitive" } } },
      { customer: { primaryMobile: { contains: params.q } } },
      { equipment: { name: { contains: params.q, mode: "insensitive" } } },
      {
        equipment: { modelNumber: { contains: params.q, mode: "insensitive" } },
      },
      {
        equipment: {
          serialNumber: { contains: params.q, mode: "insensitive" },
        },
      },
    ];
  if (
    params.priority &&
    Object.values(ComplaintPriority).includes(
      params.priority as ComplaintPriority,
    )
  )
    where.priority = params.priority as ComplaintPriority;
  if (params.technician)
    where.assignments = {
      some: { technicianId: params.technician, isActive: true },
    };
  if (params.assigned === "yes" && !params.technician)
    where.assignments = { some: { isActive: true } };
  if (params.assigned === "no")
    where.assignments = { none: { isActive: true } };
  if (params.warranty === "under")
    where.equipment = { warrantyExpiryDate: { gte: today } };
  if (params.warranty === "out")
    where.equipment = { warrantyExpiryDate: { lt: today } };
  if (params.warranty === "unknown")
    where.equipment = { warrantyExpiryDate: null };
  if (params.from || params.to) {
    where.complaintDate = {};
    if (params.from)
      where.complaintDate.gte = dateBoundary(params.from);
    if (params.to)
      where.complaintDate.lte = dateBoundary(params.to, true);
  }

  const [matchingComplaints, technicians] = await Promise.all([
    db.serviceComplaint.findMany({
      where,
      select: { id: true, serviceVisitGroupId: true, complaintDate: true },
      orderBy: { complaintDate: "desc" },
    }),
    getCachedTechnicianOptions(),
  ]);
  const visitKeys = [
    ...new Set(
      matchingComplaints.map(
        (complaint) => complaint.serviceVisitGroupId ?? complaint.id,
      ),
    ),
  ];
  const total = visitKeys.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageVisitKeys = visitKeys.slice((page - 1) * pageSize, page * pageSize);
  const visitRows = pageVisitKeys.length
    ? await db.serviceComplaint.findMany({
        where: {
          OR: [
            { id: { in: pageVisitKeys } },
            { serviceVisitGroupId: { in: pageVisitKeys } },
          ],
        },
        include: {
          customer: true,
          equipment: true,
          serviceRecord: { select: { id: true } },
          assignments: {
            where: {
              OR: [
                { isActive: true },
                { endedReason: "Service completed" },
              ],
            },
            include: { technician: true },
            orderBy: { assignedAt: "asc" },
          },
        },
        orderBy: [{ complaintDate: "desc" }, { complaintNumber: "asc" }],
      })
    : [];
  const rowsByVisit = new Map<string, typeof visitRows>();
  for (const complaint of visitRows) {
    const key = complaint.serviceVisitGroupId ?? complaint.id;
    const group = rowsByVisit.get(key) ?? [];
    group.push(complaint);
    rowsByVisit.set(key, group);
  }
  const serviceVisits = pageVisitKeys.flatMap((key) => {
    const complaints = rowsByVisit.get(key) ?? [];
    if (!complaints.length) return [];
    const primary =
      complaints.find((complaint) => complaint.id === key) ?? complaints[0];
    return [{ key, primary, complaints }];
  });
  const preservedSearchFields = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "q" &&
        entry[0] !== "page" &&
        entry[0] !== "status" &&
        entry[0] !== "created" &&
        Boolean(entry[1]),
    ),
  );
  const searchResetQuery = new URLSearchParams(preservedSearchFields).toString();
  const searchResetHref = searchResetQuery
    ? `/complaints?${searchResetQuery}`
    : "/complaints";
  const pageHref = (target: number) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        (entry): entry is [string, string] =>
          entry[0] !== "status" &&
          entry[0] !== "created" &&
          Boolean(entry[1]),
      ),
    );
    query.set("page", String(target));
    return `/complaints?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Service Complaints"
        description="Track every registered complaint from receipt to completion."
        actions={
          <Link
            href="/complaints/new"
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover"
          >
            + New Complaint
          </Link>
        }
      />
      {Number(params.created) > 1 && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
          {params.created} equipment services were added to one service visit.
        </AutoDismissNotice>
      )}
      <SearchForm
        query={params.q ?? ""}
        label="Search service complaints"
        placeholder="Search complaint, customer, phone, equipment, model or serial..."
        resetHref={searchResetHref}
        hiddenFields={preservedSearchFields}
      />
      <form className="mb-4 grid gap-2 rounded-2xl border border-brand-border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        {params.q && <input type="hidden" name="q" value={params.q} />}
        <SelectFilter
          name="priority"
          value={params.priority}
          label="All priorities"
          options={Object.values(ComplaintPriority).map((value) => [
            value,
            titleCase(value),
          ])}
        />
        <SelectFilter
          name="technician"
          value={params.technician}
          label="All technicians"
          options={technicians.map((item) => [item.id, item.name])}
        />
        <SelectFilter
          name="assigned"
          value={params.assigned}
          label="Assigned & unassigned"
          options={[
            ["yes", "Assigned"],
            ["no", "Unassigned"],
          ]}
        />
        <SelectFilter
          name="warranty"
          value={params.warranty}
          label="All warranty states"
          options={[
            ["under", "Under warranty"],
            ["out", "Out of warranty"],
            ["unknown", "Unknown warranty"],
          ]}
        />
        <input
          name="from"
          type="date"
          defaultValue={params.from}
          aria-label="From date"
          className="rounded-xl border border-brand-input px-3 py-2 text-sm outline-none hover:border-brand-primary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to}
          aria-label="To date"
          className="rounded-xl border border-brand-input px-3 py-2 text-sm outline-none hover:border-brand-primary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
        />
        <div className="flex gap-2 xl:col-span-4">
          <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover">
            Apply Filters
          </button>
          <Link
            href="/complaints"
            className="rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-subtle"
          >
            Clear
          </Link>
        </div>
      </form>
      {serviceVisits.length ? (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Visit #</th>
                  <th>Date</th>
                  <th>Customer / Phone</th>
                  <th>Equipment</th>
                  <th>Technician</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {serviceVisits.map(({ key, primary, complaints }) => {
                  const technicianNames = [
                    ...new Set(
                      complaints.flatMap((complaint) =>
                        complaint.assignments.map(
                          (assignment) => assignment.technician.name,
                        ),
                      ),
                    ),
                  ];
                  const isMultiMachineVisit = complaints.length > 1;
                  return (
                    <tr key={key}>
                      <td>
                        <Link
                          className="link"
                          href={`/complaints/${primary.id}`}
                        >
                          {primary.complaintNumber}
                        </Link>
                      </td>
                      <td>{date(primary.complaintDate)}</td>
                      <td>
                        <div className="font-semibold">
                          {primary.customer.name}
                        </div>
                        <div className="text-xs text-brand-muted">
                          {primary.customer.primaryMobile}
                        </div>
                      </td>
                      <td className="min-w-56 align-top">
                        <div className="space-y-2">
                          {complaints.map((complaint, index) => {
                            const equipmentName = complaint.equipment
                              ? [
                                  complaint.equipment.name,
                                  complaint.equipment.modelNumber,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")
                              : "Equipment not identified";
                            return (
                              <div
                                key={complaint.id}
                                className="flex items-start gap-2 rounded-lg bg-brand-subtle/65 px-2.5 py-2 font-medium text-brand-ink"
                              >
                                {isMultiMachineVisit && (
                                  <span className="shrink-0 font-bold text-brand-primary">
                                    {index + 1}.
                                  </span>
                                )}
                                <span className="break-words">{equipmentName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        {technicianNames.length
                          ? technicianNames.join(", ")
                          : "Unassigned"}
                      </td>
                      <td>
                        <Badge value={primary.priority} />
                      </td>
                      <td className="min-w-48 align-top">
                        <div className="space-y-2">
                          {complaints.map((complaint, index) => (
                            <div
                              key={complaint.id}
                              className="flex min-h-9 items-center gap-2 rounded-lg bg-brand-subtle/65 px-2.5 py-2"
                            >
                              {isMultiMachineVisit && (
                                <span className="shrink-0 font-bold text-brand-primary">
                                  {index + 1}.
                                </span>
                              )}
                              <Badge
                                value={complaint.status}
                                label={complaint.serviceRecord ? "Completed" : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No complaints found"
          text="No complaints match the selected filters."
        />
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-brand-muted">
        <span>
          {total} service visit(s) • Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold text-brand-ink hover:bg-brand-subtle"
              href={pageHref(page - 1)}
            >
              Previous
            </Link>
          )}
          {page < pages && (
            <Link
              className="rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold text-brand-ink hover:bg-brand-subtle"
              href={pageHref(page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function SelectFilter({
  name,
  value,
  label,
  options,
}: {
  name: string;
  value?: string;
  label: string;
  options: string[][];
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="rounded-xl border border-brand-input px-3 py-2 text-sm outline-none hover:border-brand-primary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    >
      <option value="">{label}</option>
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}


