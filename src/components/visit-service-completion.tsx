"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { CheckCircle2, Wrench, X } from "lucide-react";
import { completeServiceFromForm } from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";

export function VisitServiceCompletion({
  complaintId,
  complaintNumber,
  returnComplaintId,
  equipmentName,
  customerComplaint,
  actualProblem,
  workDone,
  pendingCount,
}: {
  complaintId: string;
  complaintNumber: string;
  returnComplaintId: string;
  equipmentName: string;
  customerComplaint: string;
  actualProblem: string;
  workDone: string;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover"
      >
        <Wrench size={14} aria-hidden="true" />
        Add Service Details
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`complete-visit-service-${complaintId}`}
                className="relative my-auto w-full max-w-3xl rounded-2xl border border-brand-border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
              >
                <div className="border-b border-brand-border px-6 py-5 pr-16">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-faint px-3 py-1 text-xs font-semibold text-brand-primary">
                    <Wrench size={13} aria-hidden="true" />
                    {complaintNumber}
                  </div>
                  <h2
                    id={`complete-visit-service-${complaintId}`}
                    className="text-xl font-bold text-brand-ink"
                  >
                    Add Service Details
                  </h2>
                  <p className="mt-1 break-words text-sm font-medium text-brand-secondary">
                    {equipmentName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close service details"
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-white text-brand-secondary transition hover:bg-brand-faint hover:text-brand-primary"
                >
                  <X size={18} aria-hidden="true" />
                </button>

                <ActionForm
                  action={completeServiceFromForm}
                  className="grid gap-5 p-6 md:grid-cols-2"
                >
                  <input type="hidden" name="complaintId" value={complaintId} />
                  <input type="hidden" name="returnToVisit" value="1" />
                  <input
                    type="hidden"
                    name="returnComplaintId"
                    value={returnComplaintId}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="Customer Complaint / Problem Reported"
                      hint="Recorded when this equipment service was created."
                    >
                      <Textarea value={customerComplaint} readOnly rows={3} />
                    </Field>
                  </div>
                  <Field label="Actual Problem Found" required>
                    <Textarea
                      name="actualProblem"
                      required
                      rows={4}
                      defaultValue={actualProblem}
                      placeholder="Describe the actual fault found on this machine."
                    />
                  </Field>
                  <Field label="Work Performed" required>
                    <Textarea
                      name="workDone"
                      required
                      rows={4}
                      defaultValue={workDone}
                      placeholder="Describe the repair or service completed on this machine."
                    />
                  </Field>
                  <Field
                    label="Service Amount"
                    required
                    hint="Enter 0 for warranty or free service."
                  >
                    <Input
                      name="charges"
                      required
                      type="text"
                      inputMode="decimal"
                      pattern="\d+(\.\d{1,2})?"
                      title="Enter an amount using numbers with up to two decimal places."
                      defaultValue="0"
                    />
                  </Field>
                  <div className="self-end rounded-xl border border-brand-border bg-brand-faint p-4 text-sm text-brand-secondary">
                    A separate permanent service record will be created for this
                    equipment.
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="success">
                      <CheckCircle2 size={17} aria-hidden="true" />
                      {pendingCount > 1
                        ? "Complete & Open Next Equipment"
                        : "Complete Final Equipment Service"}
                    </Button>
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
