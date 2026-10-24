import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { WarrantyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteBillDetailFromForm } from "@/actions/bill-detail";
import { date, money } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";
import { BillEditPanel } from "@/components/bill-edit-panel";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

export default async function BillDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    deleteBlocked?: string;
    deleted?: string;
    customerDeleted?: string;
    editBill?: string;
    editBlocked?: string;
  }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { q = "", deleteBlocked, deleted, customerDeleted, editBill, editBlocked } =
    await searchParams;
  if (editBill) return <BillEditPanel id={editBill} />;
  const query = q.trim();

  const bills = await db.billDetail.findMany({
    where: query
      ? {
          OR: [
            { billNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { primaryMobile: { contains: query } } },
            {
              items: {
                some: {
                  OR: [
                    { itemName: { contains: query, mode: "insensitive" } },
                    { brand: { contains: query, mode: "insensitive" } },
                    { modelNumber: { contains: query, mode: "insensitive" } },
                    { serialNumber: { contains: query, mode: "insensitive" } },
                    { units: { some: { equipment: { OR: [ { equipmentCode: { contains: query, mode: "insensitive" } }, { serialNumber: { contains: query, mode: "insensitive" } }, { modelNumber: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } } ] } } } },
                  ],
                },
              },
            },
          ],
        }
      : undefined,
    include: {
      customer: { select: { name: true, primaryMobile: true } },
      items: { select: { quantityUnit: true, units: { select: { equipment: { select: { warrantyExpiryDate: true } } } } } },
      _count: { select: { items: true } },
    },
    orderBy: [{ createdAt: "desc" }, { billDate: "desc" }],
    take: 100,
  });
  const totalProducts = bills.reduce((sum, bill) => sum + bill.items.reduce((n, item) => n + item.units.length, 0), 0);
  const activeWarrantyProducts = bills.reduce(
    (sum, bill) =>
      sum +
      bill.items.flatMap(item => item.units).filter(unit => warrantyStatus(unit.equipment.warrantyExpiryDate) === WarrantyStatus.UNDER_WARRANTY).length,
    0,
  );
  const referenceValue = bills.reduce(
    (sum, bill) => sum + Number(bill.total),
    0,
  );

  return (
    <>
      <PageHeader
        title="Bill Details"
        description="Customer purchase and warranty register for service follow-up."
        actions={
          <>
            <Link
              href="/bill-details/new"
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              + New Bill
            </Link>
            <Link
              href="/service-history"
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Service History
            </Link>
          </>
        }
      />

      {deleteBlocked && (
        <DismissibleErrorDialog
          title="Bill cannot be deleted safely"
          message={
            <>
            One or more products in this bill already has complaint or service
            history. The software keeps those records safe, so old repair
            details do not disappear accidentally.
            </>
          }
        />
      )}

      {editBlocked && (
        <DismissibleErrorDialog
          title="Bill cannot be edited"
          message="Cannot edit this bill. A complaint has already been raised for a product on this invoice."
        />
      )}

      {deleted && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-bold">Bill deleted successfully.</div>
          <div className="mt-1">
            Safe linked product records were also removed where no service work
            existed.
            {customerDeleted
              ? " The customer profile was also removed because it had no other records."
              : " The customer profile was kept if it had any other records."}
          </div>
        </AutoDismissNotice>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader
            title="Quick Search"
            subtitle="Find bill details using invoice number, customer, phone, model or serial number."
          />
          <CardBody>
            <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                name="q"
                defaultValue={q}
                placeholder="Bill no, customer, phone, model or serial..."
                className="w-full rounded-xl border border-brand-border bg-brand-subtle px-4 py-3 text-sm outline-none transition focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/10"
              />
              <button className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white">
                Search
              </button>
              {query && (
                <Link
                  href="/bill-details"
                  className="rounded-xl border border-brand-border px-5 py-3 text-center text-sm font-bold"
                >
                  Clear
                </Link>
              )}
            </form>
          </CardBody>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile label="Bill References" value={bills.length} />
          <SummaryTile label="Products Stored" value={totalProducts} />
          <SummaryTile
            label="Active Warranty"
            value={activeWarrantyProducts}
          />
          <SummaryTile label="Reference Value" value={money(referenceValue)} />
        </div>
      </div>

      <div className="space-y-6">
          <Card>
            <CardHeader
              title="Bill Reference Register"
              subtitle="Open a bill to view products, warranty details and linked service history."
            />
            <CardBody>
            {query && (
              <div className="mb-4 rounded-2xl border border-brand-border bg-brand-subtle px-4 py-3 text-sm text-brand-secondary">
                Showing results for{" "}
                <span className="font-bold text-brand-ink">&ldquo;{query}&rdquo;</span>
              </div>
            )}
            {bills.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Warranty</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => {
                      const activeWarranty = bill.items.flatMap(item => item.units).filter(unit => warrantyStatus(unit.equipment.warrantyExpiryDate) === WarrantyStatus.UNDER_WARRANTY).length;
                      const hasAnyWarranty = bill.items.some(item => item.units.some(unit => unit.equipment.warrantyExpiryDate));
                      return (
                        <tr key={bill.id}>
                          <td>
                            <Link
                              className="link"
                              href={`/bill-details/${bill.id}`}
                            >
                              {bill.billNumber}
                            </Link>
                          </td>
                          <td>
                            <Link
                              className="link"
                              href={`/customers/${bill.customerId}`}
                            >
                              {bill.customer.name}
                            </Link>
                            <div className="text-xs text-brand-muted">
                              {bill.customer.primaryMobile}
                            </div>
                          </td>
                          <td>{date(bill.billDate)}</td>
                          <td>{bill.items.some(item => item.quantityUnit === "KG") ? `${bill.items.reduce((sum, item) => sum + item.units.length, 0)} tracked items` : `${bill.items.reduce((sum, item) => sum + item.units.length, 0)} machines`} / {bill._count.items} products</td>
                          <td>
                            {activeWarranty ? (
                              <Badge value={WarrantyStatus.UNDER_WARRANTY} />
                            ) : !hasAnyWarranty ? (
                              <Badge value={WarrantyStatus.UNKNOWN} />
                            ) : (
                              <span className="text-sm text-brand-muted">
                                No active warranty
                              </span>
                            )}
                          </td>
                          <td>{money(bill.total)}</td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white"
                                href={`/bill-details/${bill.id}`}
                              >
                                Open Details
                              </Link>
                              <Link href={`/bill-details?editBill=${bill.id}`} className="rounded-xl border border-brand-accent bg-brand-faint px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-brand-soft">Edit Bill</Link>
                              <ActionForm action={deleteBillDetailFromForm}>
                                <input
                                  type="hidden"
                                  name="billDetailId"
                                  value={bill.id}
                                />
                                <ConfirmSubmitButton
                                  message={`Delete bill detail ${bill.billNumber}? This works only when products have no complaint or service history.`}
                                  className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                >
                                  Delete
                                </ConfirmSubmitButton>
                              </ActionForm>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                <EmptyState
                  title="No bill references found"
                  text="Click New Bill to add the first customer bill reference."
                />
                <div className="text-center">
                  <Link
                    href="/bill-details/new"
                    className="inline-flex rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    + New Bill
                  </Link>
                </div>
              </div>
            )}
            </CardBody>
          </Card>
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}


