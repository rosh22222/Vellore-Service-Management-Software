import { Save, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import {
  createBrand,
  deleteBrand,
  toggleBrand,
  updateBrand,
} from "@/actions/brand";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ActionFeedbackNotice } from "@/components/action-feedback-notice";

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "bg-brand-subtle text-brand-muted ring-1 ring-brand-border"
      }`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-slate-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default async function BrandsPage() {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const brands = await db.brand.findMany({
    orderBy: [{ name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Brands"
        description="Manage product brands used in product dropdowns."
      />

      <div className="mb-5 rounded-2xl border border-brand-border bg-white p-5 shadow-panel">
        <ActionForm
          action={createBrand}
          successMessage="Brand Added"
          successDuration={3000}
          feedbackChannel="brands"
          resetOnSuccess
          className="grid gap-4 lg:grid-cols-[1fr_auto]"
        >
          <Field label="New Brand" required>
            <Input
              name="name"
              required
              placeholder="Brand name"
            />
          </Field>
          <Button
            className="self-end px-5"
            loadingText="Adding..."
          >
            <Save size={17} />
            Add Brand
          </Button>
        </ActionForm>
        <ActionFeedbackNotice channel="brands" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-panel">
        <div className="table-wrap">
          <table className="table">
            <thead className="bg-brand-subtle">
              <tr>
                <th style={{ textAlign: "center" }}>Brand</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id}>
                  <td
                    className="min-w-[340px]"
                    style={{ verticalAlign: "middle" }}
                  >
                    <ActionForm
                      action={updateBrand.bind(null, brand.id)}
                      className="mx-auto grid max-w-2xl grid-cols-[minmax(180px,1fr)_auto] gap-3"
                    >
                      <label className="flex min-w-0 items-center gap-1.5">
                        <Input
                          name="name"
                          aria-label={`Brand name for ${brand.name}`}
                          required
                          defaultValue={brand.name}
                        />
                        <span aria-hidden="true" className="text-[#DC2626]">*</span>
                      </label>
                      <Button
                        className="px-5"
                        loadingText="Saving..."
                      >
                        <Save size={17} />
                        Save
                      </Button>
                    </ActionForm>
                  </td>
                  <td
                    className="text-center"
                    style={{ textAlign: "center", verticalAlign: "middle" }}
                  >
                    <StatusPill active={brand.isActive} />
                  </td>
                  <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                    <div className="flex justify-center gap-3">
                      <ActionForm
                        action={toggleBrand.bind(null, brand.id)}
                        successMessage={brand.isActive ? "Brand Deactivated" : "Brand Activated"}
                        feedbackChannel="brands"
                      >
                        <Button
                          variant="secondary"
                          className="px-5"
                          loadingText="Updating..."
                        >
                          {brand.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </ActionForm>
                      <ActionForm
                        action={deleteBrand.bind(null, brand.id)}
                        successMessage="Brand Deleted"
                        feedbackChannel="brands"
                      >
                        <ConfirmSubmitButton
                          message={`Delete brand ${brand.name}? This action cannot be undone.`}
                          className="border border-rose-200 bg-white px-5 text-rose-700 hover:bg-rose-50"
                          loadingText="Deleting..."
                        >
                          <Trash2 size={17} />
                          Delete
                        </ConfirmSubmitButton>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-brand-muted">
                    No brands added yet. Add your first brand above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
