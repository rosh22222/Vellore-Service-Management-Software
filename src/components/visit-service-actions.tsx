"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import {
  deleteVisitEquipmentServiceFromForm,
  updateVisitEquipmentServiceFromForm,
} from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

type EditableEquipment = {
  name: string;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  notes: string | null;
};

export function VisitServiceActions({
  complaintId,
  complaintNumber,
  returnComplaintId,
  customerComplaint,
  equipment,
  brands,
  allowDelete,
}: {
  complaintId: string;
  complaintNumber: string;
  returnComplaintId: string;
  customerComplaint: string;
  equipment: EditableEquipment;
  brands: Array<{ name: string }>;
  allowDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const brandOptions = equipment.brand &&
    !brands.some((brand) => brand.name === equipment.brand)
    ? [{ name: equipment.brand }, ...brands]
    : brands;

  return (
    <>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-accent bg-brand-faint px-3 py-2 text-xs font-semibold text-brand-primary transition hover:bg-brand-soft"
      >
        <Pencil size={14} aria-hidden="true" />
        Edit
      </button>

      {allowDelete && (
        <ActionForm action={deleteVisitEquipmentServiceFromForm}>
          <input type="hidden" name="complaintId" value={complaintId} />
          <input
            type="hidden"
            name="returnComplaintId"
            value={returnComplaintId}
          />
          <ConfirmSubmitButton
            message={`Delete ${equipment.name} (${complaintNumber}) from this service visit? This is allowed only before any inspection, repair, completion or payment is recorded.`}
            className="min-h-9 border border-rose-200 bg-white px-3 py-2 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </ConfirmSubmitButton>
        </ActionForm>
      )}

      {editOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setEditOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`edit-visit-service-${complaintId}`}
                className="relative my-auto w-full max-w-3xl rounded-2xl border border-brand-border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
              >
                <div className="border-b border-brand-border px-6 py-5 pr-16">
                  <h2
                    id={`edit-visit-service-${complaintId}`}
                    className="text-xl font-bold text-brand-ink"
                  >
                    Edit Equipment Service
                  </h2>
                  <p className="mt-1 text-sm text-brand-muted">
                    {complaintNumber} · Correct the machine details or reported
                    problem before completing the service.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  aria-label="Close edit equipment service"
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-white text-brand-secondary transition hover:bg-brand-faint hover:text-brand-primary"
                >
                  <X size={18} aria-hidden="true" />
                </button>

                <ActionForm
                  action={updateVisitEquipmentServiceFromForm}
                  className="grid gap-5 p-6 md:grid-cols-2"
                >
                  <input type="hidden" name="complaintId" value={complaintId} />
                  <input
                    type="hidden"
                    name="returnComplaintId"
                    value={returnComplaintId}
                  />
                  <Field label="Equipment Name" required>
                    <Input
                      name="equipmentName"
                      required
                      defaultValue={equipment.name}
                    />
                  </Field>
                  <Field label="Brand">
                    <Select
                      name="equipmentBrand"
                      defaultValue={equipment.brand ?? ""}
                    >
                      <option value="">Select brand</option>
                      {brandOptions.map((brand) => (
                        <option key={brand.name} value={brand.name}>
                          {brand.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Model Number">
                    <Input
                      name="equipmentModel"
                      defaultValue={equipment.modelNumber ?? ""}
                    />
                  </Field>
                  <Field label="Serial Number">
                    <Input
                      name="equipmentSerial"
                      defaultValue={equipment.serialNumber ?? ""}
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Customer Complaint / Problem Reported" required>
                      <Textarea
                        name="customerComplaint"
                        required
                        rows={4}
                        defaultValue={customerComplaint}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Equipment Notes">
                      <Textarea
                        name="equipmentNotes"
                        rows={3}
                        defaultValue={equipment.notes ?? ""}
                        placeholder="Optional machine identification or location details"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </ActionForm>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
