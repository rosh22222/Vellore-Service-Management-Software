import { dateInput, dateBoundary } from "@/lib/business-date";
import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { PaymentMode, Prisma, UserRole } from "@prisma/client";
import { createServiceCollection, deleteServiceCollection } from "@/actions/service-collection";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { date, money, titleCase } from "@/lib/format";

type Params = {
  q?: string;
  status?: string;
  mode?: string;
  from?: string;
  to?: string;
  page?: string;
};

const pageSize = 20;

function paymentStatus(total: number, collected: number) {
  if (total <= 0) return "NO_CHARGE";
  if (collected <= 0) return "PENDING";
  if (collected + 0.001 >= total) return "PAID";
  return "PARTIAL";
}

function statusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
  if (status === "PENDING") return "bg-rose-100 text-rose-700";
  return "bg-brand-subtle text-brand-secondary";
}

function todayInputValue() {
  return dateInput();
}

export default async function ServiceCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const serviceWhere: Prisma.ServiceRecordWhereInput = {};
  if (params.q) {
    serviceWhere.OR = [
      { serviceNumber: { contains: params.q, mode: "insensitive" } },
      { customerNameSnapshot: { contains: params.q, mode: "insensitive" } },
      { customerPhoneSnapshot: { contains: params.q } },
      { equipmentNameSnapshot: { contains: params.q, mode: "insensitive" } },
      { modelSnapshot: { contains: params.q, mode: "insensitive" } },
      { serialSnapshot: { contains: params.q, mode: "insensitive" } },
      { technicianNameSnapshot: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.from || params.to) {
    serviceWhere.serviceDate = {};
    if (params.from) {
      serviceWhere.serviceDate.gte = dateBoundary(params.from);
    }
    if (params.to) {
      serviceWhere.serviceDate.lte = dateBoundary(params.to, true);
    }
  }

  const collectionWhere: Prisma.ServiceCollectionWhereInput = {};
  if (
    params.mode &&
    Object.values(PaymentMode).includes(params.mode as PaymentMode)
  ) {
    collectionWhere.paymentMode = params.mode as PaymentMode;
  }
  if (params.from || params.to) {
    collectionWhere.collectedAt = {};
    if (params.from) {
      collectionWhere.collectedAt.gte = dateBoundary(params.from);
    }
    if (params.to) {
      collectionWhere.collectedAt.lte = dateBoundary(params.to, true);
    }
  }

  const [allServices, users, collectionEntries] = await Promise.all([
    db.serviceRecord.findMany({
      where: serviceWhere,
      include: {
        customer: true,
        equipment: true,
        technician: true,
        collections: {
          include: { collectedBy: true },
          orderBy: { collectedAt: "desc" },
        },
      },
      orderBy: { serviceDate: "desc" },
    }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.serviceCollection.findMany({
      where: collectionWhere,
      include: {
        serviceRecord: true,
        customer: true,
        equipment: true,
        technician: true,
        collectedBy: true,
      },
      orderBy: { collectedAt: "desc" },
      take: 100,
    }),
  ]);

  const servicesWithMoney = allServices.map((service) => {
    const total = Number(service.charges);
    const collected = service.collections.reduce(
      (sum, collection) => sum + Number(collection.amount),
      0,
    );
    const balance = Math.max(0, total - collected);
    const status = paymentStatus(total, collected);
    return { service, total, collected, balance, status };
  });

  const filteredServices =
    params.status && params.status !== "ALL"
      ? servicesWithMoney.filter((item) => item.status === params.status)
      : servicesWithMoney;

  const totalServices = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(totalServices / pageSize));
  const rows = filteredServices.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filteredServices.reduce((sum, item) => sum + item.total, 0);
  const totalCollected = filteredServices.reduce(
    (sum, item) => sum + item.collected,
    0,
  );
  const totalBalance = filteredServices.reduce(
    (sum, item) => sum + item.balance,
    0,
  );
  const paidCount = filteredServices.filter((item) => item.status === "PAID").length;
  const partialCount = filteredServices.filter(
    (item) => item.status === "PARTIAL",
  ).length;
  const pendingCount = filteredServices.filter(
    (item) => item.status === "PENDING",
  ).length;

  const pageHref = (target: number) => {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
    query.set("page", String(target));
    return `/service-collections?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Service Collections"
        description="Track service payment received, pending balance, payment mode and who collected the amount."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Service Amount" value={money(totalAmount)} />
        <Stat label="Collected" value={money(totalCollected)} tone="green" />
        <Stat label="Pending Balance" value={money(totalBalance)} tone="red" />
        <Stat
          label="Paid / Partial"
          value={`${paidCount} / ${partialCount}`}
          tone="amber"
        />
        <Stat label="Pending Services" value={pendingCount} />
      </div>

      <form className="mb-4 grid gap-2 rounded-2xl border border-brand-border bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder="Search service, customer, phone, equipment..."
          className="xl:col-span-2"
        />
        <Select name="status" defaultValue={params.status ?? "ALL"}>
          <option value="ALL">All payment status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
          <option value="NO_CHARGE">No charge</option>
        </Select>
        <Select name="mode" defaultValue={params.mode ?? ""}>
          <option value="">All payment modes</option>
          {Object.values(PaymentMode).map((mode) => (
            <option key={mode} value={mode}>
              {titleCase(mode)}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={params.from} />
        <Input name="to" type="date" defaultValue={params.to} />
        <div className="flex gap-2 md:col-span-2 xl:col-span-6">
          <Button>Apply Filters</Button>
          <Link
            href="/service-collections"
            className="rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length ? (
        <div className="space-y-4">
          {rows.map(({ service, total, collected, balance, status }) => (
            <Card key={service.id}>
              <CardBody>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="link text-base font-bold"
                        href={`/service-history/${service.id}`}
                      >
                        {service.serviceNumber}
                      </Link>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}
                      >
                        {titleCase(status)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <Info label="Customer" value={service.customerNameSnapshot} />
                      <Info label="Phone" value={service.customerPhoneSnapshot} />
                      <Info
                        label="Equipment"
                        value={service.equipmentNameSnapshot ?? "Not linked"}
                      />
                      <Info
                        label="Technician"
                        value={
                          service.technicianNameSnapshot ??
                          service.technician?.name ??
                          "—"
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MoneyBox label="Service Amount" value={total} />
                      <MoneyBox label="Collected" value={collected} green />
                      <MoneyBox label="Pending" value={balance} red />
                    </div>
                  </div>

                  {balance > 0 ? (
                    <ActionForm
                      action={createServiceCollection}
                      className="rounded-2xl border border-brand-border bg-brand-subtle p-4"
                    >
                      <input
                        type="hidden"
                        name="serviceRecordId"
                        value={service.id}
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Amount Received" required>
                          <Input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={balance.toFixed(2)}
                            defaultValue={balance.toFixed(2)}
                            required
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
                        <Field label="Collected By">
                          <Select name="collectedById" defaultValue={user.id}>
                            {users.map((collector) => (
                              <option key={collector.id} value={collector.id}>
                                {collector.name} ({titleCase(collector.role)})
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Collection Date">
                          <Input
                            name="collectedAt"
                            type="date"
                            defaultValue={todayInputValue()}
                          />
                        </Field>
                        <Field label="Received From">
                          <Input
                            name="receivedFrom"
                            placeholder="Customer / staff name"
                          />
                        </Field>
                        <Field label="Notes">
                          <Input name="notes" placeholder="UPI ref / cash note" />
                        </Field>
                      </div>
                      <Button variant="success" className="mt-3 w-full">
                        Save Collection
                      </Button>
                    </ActionForm>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      No pending balance for this service.
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No services found"
          text="Completed services will appear here after service closure."
        />
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-brand-muted">
        <span>
          {totalServices} service(s) - Page {page} of {totalPages}
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
          {page < totalPages && (
            <Link
              className="rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold"
              href={pageHref(page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Collection Entries"
          subtitle="Recent payment entries with amount, mode and collected-by user."
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Date</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Mode</th>
                <th>Collected By</th>
                <th>Amount</th>
                <th>Notes</th>
                {user.role === UserRole.ADMIN && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {collectionEntries.map((collection) => (
                <tr key={collection.id}>
                  <td>{collection.collectionNumber}</td>
                  <td>{date(collection.collectedAt)}</td>
                  <td>
                    <Link
                      className="link"
                      href={`/service-history/${collection.serviceRecordId}`}
                    >
                      {collection.serviceRecord.serviceNumber}
                    </Link>
                  </td>
                  <td>{collection.customer.name}</td>
                  <td>{titleCase(collection.paymentMode)}</td>
                  <td>{collection.collectedBy.name}</td>
                  <td>{money(collection.amount)}</td>
                  <td>
                    {[collection.receivedFrom, collection.notes]
                      .filter(Boolean)
                      .join(" • ") || "—"}
                  </td>
                  {user.role === UserRole.ADMIN && (
                    <td>
                      <ActionForm action={deleteServiceCollection}>
                        <input type="hidden" name="id" value={collection.id} />
                        <ConfirmSubmitButton
                          message="Delete this collection entry? Use only for wrong entries."
                          loadingText="Deleting..."
                          className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </ActionForm>
                    </td>
                  )}
                </tr>
              ))}
              {collectionEntries.length === 0 && (
                <tr>
                  <td colSpan={user.role === UserRole.ADMIN ? 9 : 8}>
                    No collection entries yet.
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "red" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-brand-ink";
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function MoneyBox({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: number;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-brand-border">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold ${green ? "text-emerald-700" : red ? "text-rose-700" : "text-brand-ink"}`}
      >
        {money(value)}
      </div>
    </div>
  );
}

