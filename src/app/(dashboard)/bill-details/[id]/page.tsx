import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { ServiceStatus } from "@prisma/client";
import {
  deleteBillDetailFromForm,
  deleteBillDetailItemFromForm,
} from "@/actions/bill-detail";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { date, money } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";
import { productQuantityLabel } from "@/lib/bill-quantity";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

const terminalStatuses = [
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];

export default async function BillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    billUpdated?: string;
    productAdded?: string;
    productUpdated?: string;
    productDeleted?: string;
    deleteBlocked?: string;
  }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const {
    billUpdated,
    productAdded,
    productUpdated,
    productDeleted,
    deleteBlocked,
  } = await searchParams;
  const bill = await db.billDetail.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: {
        include: { equipment: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!bill) notFound();

  const equipmentIds = [...new Set(bill.items.flatMap(item => item.units.map(unit => unit.equipmentId)))];

  const [serviceRecords, openComplaints] = equipmentIds.length
    ? await Promise.all([
        db.serviceRecord.findMany({
          where: { equipmentId: { in: equipmentIds } },
          include: { equipment: true, technician: true },
          orderBy: { serviceDate: "desc" },
          take: 20,
        }),
        db.serviceComplaint.findMany({
          where: {
            equipmentId: { in: equipmentIds },
            status: { notIn: terminalStatuses },
          },
          include: {
            equipment: true,
            assignments: {
              where: { isActive: true },
              include: { technician: true },
              orderBy: { assignedAt: "asc" },
            },
          },
          orderBy: { complaintDate: "desc" },
        }),
      ])
    : [[], []];
  return (
    <>
      <PageHeader
        title={bill.billNumber}
        description={`${bill.customer.name} - ${date(bill.billDate)}`}
        actions={
          <>
            <Link
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
              href={`/customers/${bill.customerId}`}
            >
              Open Customer
            </Link>
            <Link
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
              href={`/bill-details/${bill.id}/add-product`}
            >
              + Add Product
            </Link>
            <ActionForm action={deleteBillDetailFromForm}>
              <input type="hidden" name="billDetailId" value={bill.id} />
              <ConfirmSubmitButton
                message={`Delete bill detail ${bill.billNumber}? This works only when products have no complaint or service history.`}
                className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              >
                Delete Bill
              </ConfirmSubmitButton>
            </ActionForm>
            <Link
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
              href={`/complaints/new?customerId=${bill.customerId}`}
            >
              + New Complaint
            </Link>
          </>
        }
      />

      {deleteBlocked && (
        <DismissibleErrorDialog
          title="Delete blocked for safety"
          message={
            <>
            This bill/product is already connected with complaint or completed
            service history. Keep it available so previous repair work remains
            correct and traceable.
            </>
          }
        />
      )}

      {productAdded && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-semibold">Product added successfully.</div>
          <div className="mt-1">
            {productAdded} is now saved under this bill and linked with this
            customer&apos;s equipment/service history.
          </div>
        </AutoDismissNotice>
      )}

      {billUpdated && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-semibold">Bill details updated.</div>
          <div className="mt-1">
            Bill number, date and linked equipment reference are now refreshed.
          </div>
        </AutoDismissNotice>
      )}

      {productUpdated && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-semibold">Product updated successfully.</div>
          <div className="mt-1">
            {productUpdated} is now updated in both bill details and equipment.
          </div>
        </AutoDismissNotice>
      )}

      {productDeleted && (
        <AutoDismissNotice className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
          <div className="font-semibold">Product removed successfully.</div>
          <div className="mt-1">
            The bill total and linked product register were updated safely.
          </div>
        </AutoDismissNotice>
      )}

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader title="Customer Details" />
          <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <div className="label">Customer</div>
              <div className="value">
                <Link className="link" href={`/customers/${bill.customerId}`}>
                  {bill.customer.name}
                </Link>
              </div>
            </div>
            <div>
              <div className="label">Phone</div>
              <div className="value font-semibold">
                {bill.customer.primaryMobile}
              </div>
            </div>
            <div>
              <div className="label">Address</div>
              <div className="value">
                {bill.customer.address}, {bill.customer.city},{" "}
                {bill.customer.state}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Stored Bill Reference"
            subtitle="This is not a printable bill. It is the sale reference already given to the customer."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="label">Invoice No.</div>
              <div className="value font-semibold">{bill.billNumber}</div>
            </div>
            <div>
              <div className="label">Bill Date</div>
              <div className="value">{date(bill.billDate)}</div>
            </div>
            <div>
              <div className="label">Items</div>
              <div className="value">{bill.items.length}</div>
            </div>
            <div>
              <div className="label">Reference Total</div>
              <div className="value font-semibold">{money(bill.total)}</div>
            </div>
            <div className="sm:col-span-2 xl:col-span-4">
              <div className="label">Notes</div>
              <div className="value">{bill.notes ?? "—"}</div>
            </div>
            <div className="sm:col-span-2 xl:col-span-4 text-xs text-brand-muted">
              Created by {bill.createdBy.name} on {date(bill.createdAt, true)}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Products Stored Under This Bill"
          subtitle="These products are linked with warranty, complaints and service history."
          action={
            <Link
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
              href={`/bill-details/${bill.id}/add-product`}
            >
              + Add Product
            </Link>
          }
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product / Equipment</th>
                <th>Model / Serial</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Warranty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item) => {
                const productName = item.units.length === 1 ? item.equipment?.name ?? item.itemName : item.itemName;
                const productBrand = item.units.length === 1 ? item.equipment?.brand ?? item.brand : item.brand;
                const productModel =
                  item.equipment?.modelNumber ?? item.modelNumber;
                const productSerial =
                  item.equipment?.serialNumber ?? item.serialNumber;
                const expiry =
                  item.equipment?.warrantyExpiryDate ??
                  item.warrantyExpiryDate ??
                  null;
                const status = warrantyStatus(expiry);
                return (
                  <Fragment key={item.id}>
                  <tr>
                    <td>
                      {item.equipment && item.units.length === 1 ? (
                        <Link
                          className="link"
                          href={`/equipment/${item.equipment.id}`}
                        >
                          {productName}
                        </Link>
                      ) : (
                        productName
                      )}
                      <div className="text-xs text-brand-muted">
                        {productBrand || "Registered from bill details"}
                      </div>
                      {item.units.length === 1 && <div className="mt-1 text-xs text-brand-muted">{item.units[0].equipment.equipmentCode}</div>}
                    </td>
                    <td>
                      {productModel ?? "—"}
                      <div className="text-xs text-brand-muted">
                        {item.quantityUnit === "KG" ? "Weight-based product" : item.units.length > 1 ? `${item.units.length} individually tracked machines` : productSerial ?? "No serial"}
                      </div>
                    </td>
                    <td>{productQuantityLabel(item.quantity, item.quantityUnit)}</td>
                    <td>{money(item.amount)}{item.quantityUnit === "KG" && <div className="text-xs text-brand-muted">{money(item.unitPrice)} / Kg</div>}</td>
                    <td>
                      {item.units.length > 1 ? <span className="text-xs text-brand-muted">See each machine's warranty below</span> : <>
                      <Badge value={status} />
                      <div className="mt-1 text-xs text-brand-muted">
                        {expiry ? `Expiry: ${date(expiry)}` : "No Warranty"}
                      </div>
                      </>}
                    </td>
                    <td>
                      {item.units.length === 1 ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white"
                            href={`/complaints/new?customerId=${bill.customerId}&equipmentId=${item.equipmentId}`}
                          >
                            Complaint Form
                          </Link>
                          <Link
                            className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-secondary hover:bg-brand-subtle"
                            href={`/bill-details/${bill.id}/items/${item.id}/edit`}
                          >
                            Edit
                          </Link>
                          <ActionForm action={deleteBillDetailItemFromForm}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <ConfirmSubmitButton
                              message={`Delete ${productName} from this bill? This works only when it has no complaint or service history.`}
                              className="border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </ActionForm>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-secondary hover:bg-brand-subtle"
                            href={`/bill-details/${bill.id}/items/${item.id}/edit`}
                          >
                            Edit
                          </Link>
                          <ActionForm action={deleteBillDetailItemFromForm}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <ConfirmSubmitButton
                              message={`Delete ${productName} from this bill?`}
                              className="border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  </tr>
                  {item.units.length > 1 && (
                    <tr>
                      <td colSpan={6} className="bg-brand-faint/50">
                        <div className="grid gap-3 p-2 md:grid-cols-2 xl:grid-cols-3">
                          {item.units.map(unit => (
                            <div key={unit.id} className="rounded-xl border border-brand-border bg-white p-4">
                              <p className="text-sm font-semibold text-brand-ink">Machine {unit.unitNumber} - {unit.equipment.name}</p>
                              <p className="mt-1 text-xs font-semibold text-brand-primary">{unit.equipment.equipmentCode}</p>
                              <p className="mt-1 text-xs text-brand-muted">Serial: {unit.equipment.serialNumber || "Not provided"}</p>
                              {unit.equipment.modelNumber && <p className="text-xs text-brand-muted">Model: {unit.equipment.modelNumber}</p>}
                              <div className="mt-2"><Badge value={warrantyStatus(unit.equipment.warrantyExpiryDate)} /></div>
                              <p className="mt-1 text-xs text-brand-muted">{unit.equipment.warrantyExpiryDate ? `Expiry: ${date(unit.equipment.warrantyExpiryDate)}` : "No Warranty"}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary-hover" href={`/complaints/new?customerId=${bill.customerId}&equipmentId=${unit.equipmentId}`}>New Complaint</Link>
                                <Link className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold text-brand-secondary hover:bg-brand-faint" href={`/equipment/${unit.equipmentId}`}>Machine / History</Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.85fr]">
        <Card>
          <CardHeader
            title="Open Complaints for These Products"
            subtitle="Problems already raised for products under this stored bill."
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Equipment</th>
                  <th>Visit Date</th>
                  <th>Technician</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {openComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <Link
                        className="link"
                        href={`/complaints/${complaint.id}`}
                      >
                        {complaint.complaintNumber}
                      </Link>
                      <div className="text-xs text-brand-muted">
                        {complaint.customerComplaint}
                      </div>
                    </td>
                    <td>{complaint.equipment?.name ?? "—"}</td>
                    <td>{date(complaint.preferredVisitDate)}</td>
                    <td>
                      {complaint.assignments.length
                        ? complaint.assignments.map((assignment) => assignment.technician.name).join(", ")
                        : "Not assigned"}
                    </td>
                    <td>
                      <Badge value={complaint.status} />
                    </td>
                  </tr>
                ))}
                {openComplaints.length === 0 && (
                  <tr>
                    <td colSpan={5}>No open complaints for these items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      <Card className="mt-6">
        <CardHeader
          title="Previous Services for Products in This Bill"
          subtitle="Shows what was repaired earlier before the next technician visit."
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Equipment</th>
                <th>Problem Found</th>
                <th>Work Done</th>
                <th>Technician</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {serviceRecords.map((service) => (
                <tr key={service.id}>
                  <td>
                    <Link className="link" href={`/service-history/${service.id}`}>
                      {service.serviceNumber}
                    </Link>
                  </td>
                  <td>{date(service.serviceDate)}</td>
                  <td>
                    {service.equipment?.name ??
                      service.equipmentNameSnapshot ??
                      "—"}
                  </td>
                  <td>{service.problemFound}</td>
                  <td className="max-w-md whitespace-pre-line">
                    {service.workDone}
                  </td>
                  <td>
                    {service.technicianNameSnapshot ??
                      service.technician?.name ??
                      "—"}
                  </td>
                  <td>{money(service.charges)}</td>
                </tr>
              ))}
              {serviceRecords.length === 0 && (
                <tr>
                  <td colSpan={7}>No completed service history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}


