import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTechnician } from "@/actions/technician";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export default async function EditTechnicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["ADMIN"]);
  const { id } = await params;
  const technician = await db.technician.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!technician) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${technician.name}`}
        description={`${technician.technicianCode} · Update the technician profile and login details.`}
        actions={
          <Link
            href={`/technicians/${technician.id}`}
            className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-secondary transition hover:bg-brand-subtle"
          >
            Cancel
          </Link>
        }
      />

      <ActionForm action={updateTechnician.bind(null, technician.id)}>
        <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <Card>
            <CardHeader
              title="Technician Profile"
              subtitle="Update technician contact details and specialization."
            />
            <CardBody className="grid gap-5 md:grid-cols-2">
              <Field label="Technician Name" required>
                <Input name="name" defaultValue={technician.name} required />
              </Field>
              <Field label="Mobile" required>
                <Input name="mobile" defaultValue={technician.mobile} required />
              </Field>
              <Field label="Email" required>
                <Input
                  name="email"
                  type="email"
                  required
                  defaultValue={technician.email ?? ""}
                />
              </Field>
              <Field label="Address">
                <Input name="address" defaultValue={technician.address ?? ""} />
              </Field>
              <Field label="Specialization">
                <Input
                  name="specialization"
                  defaultValue={technician.specialization ?? ""}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Login Access"
              subtitle="The technician uses these details to sign in."
            />
            <CardBody className="space-y-5">
              {technician.user ? (
                <>
                  <Field label="Login Username" required>
                    <Input
                      name="username"
                      defaultValue={technician.user.username}
                      required
                    />
                  </Field>
                  <Field
                    label="New Password"
                    hint="Leave blank to keep the current password. Minimum 8 characters when changed."
                  >
                    <Input
                      name="newPassword"
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  No login account is linked to this technician. Profile details
                  can still be updated.
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link
            href={`/technicians/${technician.id}`}
            className="rounded-2xl border border-brand-border bg-white px-5 py-3 text-sm font-bold text-brand-secondary transition hover:bg-brand-subtle"
          >
            Cancel
          </Link>
          <Button type="submit" loadingText="Saving technician...">
            Save Changes
          </Button>
        </div>
      </ActionForm>
    </>
  );
}
