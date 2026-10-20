import { ActionForm } from "@/components/action-form";
import { EquipmentStatus } from "@prisma/client";
import { createEquipment } from "@/actions/equipment";
import { requireRoles } from "@/lib/auth";
import { getCachedCustomerOptions } from "@/lib/cached-lookups";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/format";

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { customerId } = await searchParams;
  const customers = await getCachedCustomerOptions();
  return (
    <>
      <PageHeader
        title="Register Equipment"
        description="Link the machine to its customer. Warranty status will be calculated automatically from the expiry date."
      />
      <Card>
        <CardBody>
          <ActionForm
            action={createEquipment}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Customer" required>
              <Select
                name="customerId"
                required
                defaultValue={customerId ?? ""}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • {c.primaryMobile}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment Name" required>
              <Input name="name" required placeholder="Treadmill" />
            </Field>
            <Field label="Brand">
              <Input name="brand" />
            </Field>
            <Field label="Model Number">
              <Input name="modelNumber" placeholder="Model number" />
            </Field>
            <Field label="Serial Number">
              <Input name="serialNumber" />
            </Field>
            <Field label="Purchase Date">
              <Input name="purchaseDate" type="date" />
            </Field>
            <Field label="Stored Bill Reference">
              <Input name="invoiceNumber" />
            </Field>
            <Field label="Installation Date">
              <Input name="installationDate" type="date" />
            </Field>
            <Field label="Warranty Start">
              <Input name="warrantyStartDate" type="date" />
            </Field>
            <Field label="Warranty Expiry">
              <Input name="warrantyExpiryDate" type="date" />
            </Field>
            <Field label="Warranty Duration">
              <Input name="warrantyDuration" placeholder="12 Months" />
            </Field>
            <Field label="Equipment Status">
              <Select name="status">
                {Object.values(EquipmentStatus).map((v) => (
                  <option key={v} value={v}>
                    {titleCase(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit">Register Equipment</Button>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
