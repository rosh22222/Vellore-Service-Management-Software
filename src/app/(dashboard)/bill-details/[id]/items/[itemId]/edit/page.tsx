import { dateInput, dateBoundary } from "@/lib/business-date";
import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBillDetailItem } from "@/actions/bill-detail";
import {
  BillProductFields,
  type BillProductDefaultValues,
} from "@/components/bill-product-fields";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { getCachedActiveBrands } from "@/lib/cached-lookups";

const dv = (value: Date | null | undefined) =>
  value ? dateInput(value) : "";

export default async function EditBillProductPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id, itemId } = await params;
  const [item, brands] = await Promise.all([
    db.billDetailItem.findUnique({
      where: { id: itemId },
      include: {
        equipment: true,
        units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } },
        billDetail: { include: { customer: true } },
      },
    }),
    getCachedActiveBrands(),
  ]);
  if (!item || item.billDetailId !== id) notFound();
  const multipleMachines = item.quantityUnit === "UNIT" && Number(item.quantity) > 1;

  const defaults: BillProductDefaultValues = {
    itemName: item.itemName,
    brand: item.brand ?? item.equipment?.brand ?? "",
    modelNumber: item.modelNumber ?? item.equipment?.modelNumber ?? "",
    serialNumber: item.serialNumber ?? item.equipment?.serialNumber ?? "",
    quantity: item.quantity.toString(),
    quantityUnit: item.quantityUnit,
    unitPrice: item.unitPrice.toString(),
    installationDate: dv(item.equipment?.installationDate),
    warrantyStartDate: dv(
      multipleMachines ? item.warrantyStartDate : item.warrantyStartDate ?? item.equipment?.warrantyStartDate,
    ),
    warrantyExpiryDate: dv(
      multipleMachines ? item.warrantyExpiryDate : item.warrantyExpiryDate ?? item.equipment?.warrantyExpiryDate,
    ),
    warrantyDuration:
      multipleMachines ? item.warrantyDuration ?? "" : item.warrantyDuration ?? item.equipment?.warrantyDuration ?? "",
    itemNotes: item.notes ?? item.equipment?.notes ?? "",
    units: item.units.map(unit => ({ equipmentId: unit.equipmentId, equipmentCode: unit.equipment.equipmentCode, serialNumber: unit.equipment.serialNumber, updatedAt: unit.equipment.updatedAt.toISOString() })),
  };

  return (
    <>
      <PageHeader
        title="Edit Product"
        description={`${item.billDetail.billNumber} - ${item.billDetail.customer.name}`}
        actions={
          <Link
            className="rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-secondary shadow-sm hover:bg-brand-subtle"
            href={`/bill-details/${item.billDetailId}`}
          >
            Back to Bill
          </Link>
        }
      />

      <Card>
        <CardHeader
          title={item.itemName}
          subtitle="Update product, price and warranty details for this saved bill."
        />
        <CardBody>
          <ActionForm
            action={updateBillDetailItem.bind(null, item.id)}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            <div className="md:col-span-2 xl:col-span-4">
              <BillProductFields
                defaults={defaults}
                brandOptions={brands.map((brand) => brand.name)}
              />
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
              <Button type="submit" loadingText="Saving product...">
                Save Product
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-secondary shadow-sm hover:bg-brand-subtle"
                href={`/bill-details/${item.billDetailId}`}
              >
                Cancel
              </Link>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
