import { ActionForm } from "@/components/action-form";
import { notFound } from "next/navigation";
import { CustomerType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { updateCustomer } from "@/actions/customer";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/format";
export default async function EditCustomer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} description={c.customerCode} />
      <Card>
        <CardBody>
          <ActionForm
            action={updateCustomer.bind(null, c.id)}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Customer Type" required>
              <Select name="type" defaultValue={c.type} required>
                {Object.values(CustomerType).map((v) => (
                  <option value={v} key={v}>
                    {titleCase(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer Name" required>
              <Input name="name" defaultValue={c.name} required />
            </Field>
            <Field label="Primary Mobile" required>
              <Input
                name="primaryMobile"
                defaultValue={c.primaryMobile}
                required
              />
            </Field>
            <Field label="Alternate Mobile">
              <Input
                name="alternateMobile"
                defaultValue={c.alternateMobile ?? ""}
              />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={c.email ?? ""} />
            </Field>
            <Field label="Address" required>
              <Input name="address" defaultValue={c.address} required />
            </Field>
            <Field label="City" required>
              <Input name="city" defaultValue={c.city} required />
            </Field>
            <Field label="State" required>
              <Input name="state" defaultValue={c.state} required />
            </Field>
            <Field label="PIN Code" required>
              <Input name="pinCode" defaultValue={c.pinCode ?? ""} required />
            </Field>
            <Field label="GST">
              <Input name="gstNumber" defaultValue={c.gstNumber ?? ""} />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Notes">
                <Textarea name="notes" defaultValue={c.notes ?? ""} />
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
