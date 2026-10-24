import { dateInput, dateBoundary } from "@/lib/business-date";
import Link from "next/link";
import { Prisma, WarrantyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchForm } from "@/components/ui/search-form";
import { date, money, titleCase } from "@/lib/format";
import {
  getCachedCustomerOptions,
  getCachedEquipmentOptions,
  getCachedTechnicianOptions,
} from "@/lib/cached-lookups";

type Params = {
  q?: string;
  technician?: string;
  customer?: string;
  equipment?: string;
  warranty?: string;
  from?: string;
  to?: string;
  page?: string;
};

const pageSize = 25;

export default async function ServiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const where: Prisma.ServiceRecordWhereInput = {};

  if (params.q) {
    where.OR = [
      { serviceNumber: { contains: params.q, mode: "insensitive" } },
      { customerNameSnapshot: { contains: params.q, mode: "insensitive" } },
      { customerPhoneSnapshot: { contains: params.q } },
      { equipmentNameSnapshot: { contains: params.q, mode: "insensitive" } },
      { modelSnapshot: { contains: params.q, mode: "insensitive" } },
      { serialSnapshot: { contains: params.q, mode: "insensitive" } },
      { problemFound: { contains: params.q, mode: "insensitive" } },
      { workDone: { contains: params.q, mode: "insensitive" } },
      { technicianNameSnapshot: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.technician)
    where.complaint = {
      assignments: { some: { technicianId: params.technician } },
    };
  if (params.customer) where.customerId = params.customer;
  if (params.equipment) where.equipmentId = params.equipment;
  if (
    params.warranty &&
    Object.values(WarrantyStatus).includes(params.warranty as WarrantyStatus)
  ) {
    where.warrantyStatus = params.warranty as WarrantyStatus;
  }
  if (params.from || params.to) {
    where.serviceDate = {};
    if (params.from) where.serviceDate.gte = dateBoundary(params.from);
    if (params.to)
      where.serviceDate.lte = dateBoundary(params.to, true);
  }

  const [
    rows,
    total,
    technicians,
    customers,
    equipment,
    totals,
    collectionTotals,
  ] =
    await Promise.all([
      db.serviceRecord.findMany({
        where,
        include: {
          customer: true,
          equipment: true,
          technician: true,
          collections: { select: { amount: true } },
        },
        orderBy: { serviceDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.serviceRecord.count({ where }),
      getCachedTechnicianOptions(),
      getCachedCustomerOptions(),
      getCachedEquipmentOptions(),
      db.serviceRecord.aggregate({
        where,
        _sum: { charges: true },
      }),
      db.serviceCollection.aggregate({
        where: { serviceRecord: where },
        _sum: { amount: true },
      }),
    ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const totalCharges = Number(totals._sum.charges ?? 0);
  const totalCollected = Number(collectionTotals._sum.amount ?? 0);
  const totalPending = Math.max(0, totalCharges - totalCollected);
  const preservedSearchFields = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "q" && entry[0] !== "page" && Boolean(entry[1]),
    ),
  );
  const searchResetQuery = new URLSearchParams(preservedSearchFields).toString();
  const searchResetHref = searchResetQuery
    ? `/service-history?${searchResetQuery}`
    : "/service-history";
  const pageHref = (target: number) => {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
    query.set("page", String(target));
    return `/service-history?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Service History"
        description="Permanent completed-service register for customer, equipment, technician, warranty, parts and charges lookup."
        actions={
          <Link
            href="/reports"
            className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Open Reports
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Records Found
          </div>
          <div className="mt-1 text-2xl font-bold text-brand-ink">{total}</div>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Service Amount
          </div>
          <div className="mt-1 text-2xl font-bold text-brand-ink">
            {money(totalCharges)}
          </div>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Collected
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">
            {money(totalCollected)}
          </div>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Pending Balance
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-700">
            {money(totalPending)}
          </div>
        </div>
      </div>

      <SearchForm
        query={params.q ?? ""}
        label="Search service history"
        placeholder="Search service, customer, phone, equipment, model or serial..."
        resetHref={searchResetHref}
        hiddenFields={preservedSearchFields}
      />
      <form className="mb-4 grid gap-2 rounded-2xl border border-brand-border bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        {params.q && <input type="hidden" name="q" value={params.q} />}
        <SelectFilter
          name="technician"
          value={params.technician}
          label="All technicians"
          options={technicians.map((item) => [item.id, item.name])}
        />
        <SelectFilter
          name="customer"
          value={params.customer}
          label="All customers"
          options={customers.map((item) => [item.id, item.name])}
        />
        <SelectFilter
          name="equipment"
          value={params.equipment}
          label="All equipment"
          options={equipment
            .filter(
              (item) => !params.customer || item.customerId === params.customer,
            )
            .map((item) => [
              item.id,
              `${item.name}${item.modelNumber ? ` - ${item.modelNumber}` : ""}`,
            ])}
        />
        <SelectFilter
          name="warranty"
          value={params.warranty}
          label="All warranty"
          options={Object.values(WarrantyStatus).map((value) => [
            value,
            titleCase(value),
          ])}
        />
        <input
          name="from"
          type="date"
          defaultValue={params.from}
          aria-label="From date"
          className="rounded-xl border border-brand-border px-3 py-2 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to}
          aria-label="To date"
          className="rounded-xl border border-brand-border px-3 py-2 text-sm"
        />
        <div className="flex gap-2 md:col-span-2 xl:col-span-3">
          <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
            Apply Filters
          </button>
          <Link
            href="/service-history"
            className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length ? (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service #</th>
                  <th>Date</th>
                  <th>Customer / Phone</th>
                  <th>Equipment</th>
                  <th>Problem Found</th>
                  <th>Technician</th>
                  <th>Warranty</th>
                  <th>Service Amount</th>
                  <th>Collected</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const collected = record.collections.reduce(
                    (sum, collection) => sum + Number(collection.amount),
                    0,
                  );
                  const pending = Math.max(0, Number(record.charges) - collected);
                  return (
                    <tr key={record.id}>
                      <td>
                        <Link
                          className="link"
                          href={`/service-history/${record.id}`}
                        >
                          {record.serviceNumber}
                        </Link>
                      </td>
                      <td>{date(record.serviceDate)}</td>
                      <td>
                        <div className="font-semibold">
                          {record.customerNameSnapshot}
                        </div>
                        <div className="text-xs text-brand-muted">
                          {record.customerPhoneSnapshot}
                        </div>
                      </td>
                      <td>
                        {record.equipmentNameSnapshot ?? "Not linked"}
                        <div className="text-xs text-brand-muted">
                          {[record.modelSnapshot, record.serialSnapshot]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      </td>
                      <td className="max-w-sm">{record.problemFound}</td>
                      <td>
                        {record.technicianNameSnapshot ??
                          record.technician?.name ??
                          "Unassigned"}
                      </td>
                      <td>
                        <Badge value={record.warrantyStatus} />
                      </td>
                      <td>{money(record.charges)}</td>
                      <td className="font-semibold text-emerald-700">
                        {money(collected)}
                      </td>
                      <td className={pending > 0 ? "font-semibold text-rose-700" : ""}>
                        {money(pending)}
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
          title="No service history found"
          text="No completed service records match the selected filters."
        />
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-brand-muted">
        <span>
          {total} record(s) - Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold"
              href={pageHref(page - 1)}
            >
              Previous
            </Link>
          )}
          {page < pages && (
            <Link
              className="rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold"
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
      className="rounded-xl border border-brand-border px-3 py-2 text-sm"
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


