import { dateInput, dateBoundary } from "@/lib/business-date";
import { ActionForm } from "@/components/action-form";
import { notFound } from "next/navigation";
import { EquipmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { updateEquipment } from "@/actions/equipment";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/format";
const dv = (d: Date | null) => (d ? dateInput(d) : "");
export default async function EditEquipment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const e = await db.customerEquipment.findUnique({
    where: { id },
    include: { customer: true, billDetailItems: { select: { quantityUnit: true } }, billDetailUnits: { select: { billDetailItem: { select: { quantityUnit: true } } } } },
  });
  if (!e) notFound();
  const isKg = e.billDetailItems.some(item => item.quantityUnit === "KG") || e.billDetailUnits.some(unit => unit.billDetailItem.quantityUnit === "KG");
  return (
    <>
      <PageHeader
        title={`Edit ${e.name}`}
        description={`${e.equipmentCode} • ${e.customer.name}`}
      />
      <Card>
        <CardBody>
          <ActionForm
            action={updateEquipment.bind(null, e.id)}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Equipment Name" required>
              <Input name="name" defaultValue={e.name} required />
            </Field>
            <Field label="Brand">
              <Input name="brand" defaultValue={e.brand ?? ""} />
            </Field>
            <Field label="Model">
              <Input name="modelNumber" defaultValue={e.modelNumber ?? ""} />
            </Field>
            {!isKg && <Field label="Serial">
              <Input name="serialNumber" defaultValue={e.serialNumber ?? ""} />
            </Field>}
            <Field label="Stored Bill Reference">
              <Input
                name="invoiceNumber"
                defaultValue={e.invoiceNumber ?? ""}
              />
            </Field>
            <Field label="Purchase Date">
              <Input
                name="purchaseDate"
                type="date"
                defaultValue={dv(e.purchaseDate)}
              />
            </Field>
            <Field label="Installation">
              <Input
                name="installationDate"
                type="date"
                defaultValue={dv(e.installationDate)}
              />
            </Field>
            <Field label="Warranty Start">
              <Input
                name="warrantyStartDate"
                type="date"
                defaultValue={dv(e.warrantyStartDate)}
              />
            </Field>
            <Field label="Warranty Expiry">
              <Input
                name="warrantyExpiryDate"
                type="date"
                defaultValue={dv(e.warrantyExpiryDate)}
              />
            </Field>
            <Field label="Warranty Duration">
              <Input
                name="warrantyDuration"
                defaultValue={e.warrantyDuration ?? ""}
              />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={e.status}>
                {Object.values(EquipmentStatus).map((v) => (
                  <option value={v} key={v}>
                    {titleCase(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Notes">
                <Textarea name="notes" defaultValue={e.notes ?? ""} />
              </Field>
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <Button>Save Changes</Button>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
