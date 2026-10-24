import { ActionForm } from "@/components/action-form";
import { CustomerType } from "@prisma/client";
import { createCustomer } from "@/actions/customer";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/format";
import { PhoneInput } from "@/components/ui/phone-input";
import { PinCodeInput } from "@/components/ui/pin-code-input";

export default async function NewCustomerPage() {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  return (
    <>
      <PageHeader
        title="Add Customer"
        description="Create the customer profile first. Equipment and service history will be linked to this record."
      />
      <Card>
        <CardBody>
          <ActionForm
            action={createCustomer}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Customer Type" required>
              <Select name="type" required defaultValue="">
                <option value="" disabled>
                  Please select type
                </option>
                {Object.values(CustomerType).map((v) => (
                  <option key={v} value={v}>
                    {titleCase(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer Name" required>
              <Input name="name" required placeholder="Customer / gym name" />
            </Field>
            <Field label="Primary Mobile" required>
              <PhoneInput name="primaryMobile" required />
            </Field>
            <Field label="Alternate Mobile">
              <PhoneInput name="alternateMobile" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field label="Address" required>
              <Input name="address" required />
            </Field>
            <Field label="City" required>
              <Input name="city" required defaultValue="Vellore" />
            </Field>
            <Field label="State" required>
              <Input name="state" required defaultValue="Tamil Nadu" />
            </Field>
            <Field label="PIN Code" required>
              <PinCodeInput name="pinCode" required />
            </Field>
            <Field label="GST Number">
              <Input name="gstNumber" />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit">Create Customer</Button>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
