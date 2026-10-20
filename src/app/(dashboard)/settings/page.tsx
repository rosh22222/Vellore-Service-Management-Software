import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { updateCompanySettings } from "@/actions/settings";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  await requireRoles(["ADMIN"]);
  const s = await db.companySetting.findUnique({ where: { id: "company" } });
  return (
    <>
      <PageHeader
        title="Company Settings"
        description="Company contact details used by the app and generated PDFs."
      />
      <Card>
        <CardBody>
          <ActionForm
            action={updateCompanySettings}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Company Name" required>
              <Input
                name="companyName"
                required
                defaultValue={s?.companyName ?? "VELLORE FITNESS EQUIPMENTS"}
              />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={s?.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={s?.email ?? ""} />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Address">
                <Textarea name="address" defaultValue={s?.address ?? ""} />
              </Field>
            </div>
            <Field label="GST Number">
              <Input name="gstNumber" defaultValue={s?.gstNumber ?? ""} />
            </Field>
            <Field label="Website">
              <Input name="website" defaultValue={s?.website ?? ""} />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Button>Save Settings</Button>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
