import Link from "next/link";
import { CustomerType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertBillEditable, BILL_EDIT_BLOCKED } from "@/lib/bill-edit";
import { dateInput } from "@/lib/business-date";
import { BillDetailForm } from "@/components/bill-detail-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { getCachedActiveBrands } from "@/lib/cached-lookups";

export async function BillEditPanel({ id }: { id: string }) {
  const [bill, brands] = await Promise.all([
    db.billDetail.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            equipment: true,
            units: {
              include: { equipment: true },
              orderBy: { unitNumber: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getCachedActiveBrands(),
  ]);
  if (!bill) notFound();

  try {
    await assertBillEditable(db, id);
  } catch (error) {
    if (error instanceof Error && error.message === BILL_EDIT_BLOCKED) {
      redirect("/bill-details?editBlocked=1");
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title={`Edit Bill — ${bill.billNumber}`}
        actions={
          <Link
            href="/bill-details"
            className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Back to Bill Details
          </Link>
        }
      />
      <Card>
        <CardBody>
          <BillDetailForm
            customers={[]}
            customerTypes={Object.values(CustomerType)}
            initialBillNumber={bill.billNumber}
            brandOptions={brands.map((brand) => brand.name)}
            editing={{
              id: bill.id,
              billDate: dateInput(bill.billDate),
              billVersion: bill.updatedAt.toISOString(),
              customer: {
                ...bill.customer,
                updatedAt: bill.customer.updatedAt.toISOString(),
              },
              products: bill.items.map((item) => ({
                id: item.id,
                itemId: item.id,
                defaults: {
                  itemName: item.itemName,
                  brand: item.brand,
                  modelNumber: item.modelNumber,
                  serialNumber: item.serialNumber,
                  quantity: item.quantity.toString(),
                  quantityUnit: item.quantityUnit,
                  unitPrice: item.unitPrice.toString(),
                  installationDate: item.equipment?.installationDate
                    ? dateInput(item.equipment.installationDate)
                    : "",
                  warrantyStartDate: item.warrantyStartDate
                    ? dateInput(item.warrantyStartDate)
                    : "",
                  warrantyExpiryDate: item.warrantyExpiryDate
                    ? dateInput(item.warrantyExpiryDate)
                    : "",
                  warrantyDuration: item.warrantyDuration,
                  itemNotes: item.notes,
                  units: item.units.map((unit) => ({
                    equipmentId: unit.equipmentId,
                    equipmentCode: unit.equipment.equipmentCode,
                    serialNumber: unit.equipment.serialNumber,
                    updatedAt: unit.equipment.updatedAt.toISOString(),
                  })),
                },
              })),
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
