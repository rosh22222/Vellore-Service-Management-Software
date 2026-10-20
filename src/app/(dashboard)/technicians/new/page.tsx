import { ActionForm } from "@/components/action-form";
import { createTechnician } from "@/actions/technician";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export default async function NewTechnicianPage() {
  await requireRoles(["ADMIN"]);
  return (
    <>
      <PageHeader
        title="Add Technician"
        description="Creates both the technician profile and technician login credentials."
      />
      <Card>
        <CardBody>
          <ActionForm
            action={createTechnician}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Name" required>
              <Input name="name" required />
            </Field>
            <Field label="Mobile" required>
              <Input name="mobile" required />
            </Field>
            <Field label="Email" required>
              <Input name="email" type="email" required />
            </Field>
            <Field label="Address">
              <Input name="address" />
            </Field>
            <Field label="Specialization">
              <Input name="specialization" />
            </Field>
            <Field label="Login Username" required>
              <Input name="username" required />
            </Field>
            <Field
              label="Temporary Password"
              required
              hint="Minimum 8 characters. Change before live use."
            >
              <Input name="password" type="password" required minLength={8} />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit">Create Technician</Button>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
