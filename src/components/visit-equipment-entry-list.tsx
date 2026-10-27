"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

type BrandOption = { name: string };
type EquipmentRow = { id: string; initialProblem: string };

export const MAX_EQUIPMENT_PER_VISIT = 25;

export function VisitEquipmentEntryList({
  brands,
  initialProblem = "",
  onCountChange,
}: {
  brands: BrandOption[];
  initialProblem?: string;
  onCountChange?: (count: number) => void;
}) {
  const nextId = useRef(2);
  const [rows, setRows] = useState<EquipmentRow[]>([
    { id: "1", initialProblem },
  ]);

  useEffect(() => onCountChange?.(rows.length), [onCountChange, rows.length]);

  function addRow() {
    if (rows.length >= MAX_EQUIPMENT_PER_VISIT) return;
    const id = String(nextId.current);
    nextId.current += 1;
    setRows((current) => [...current, { id, initialProblem: "" }]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <section className="rounded-2xl border border-brand-accent/60 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-brand-ink">
            Register Equipment for This Visit
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-brand-muted">
            Add every machine requiring service. Each machine gets its own
            complaint number, problem, repair details and service history.
          </p>
        </div>
        <span className="rounded-full border border-brand-border bg-brand-faint px-3 py-1 text-xs font-semibold text-brand-primary">
          {rows.length} equipment {rows.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-2xl border border-brand-border bg-brand-faint/35 p-4"
          >
            <input type="hidden" name="equipmentRows" value={row.id} />
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-brand-border pb-3">
              <div>
                <p className="text-sm font-bold text-brand-ink">
                  Equipment {index + 1}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  Enter this machine and its reported problem.
                </p>
              </div>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove equipment ${index + 1}`}
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Equipment Name" required>
                <Input
                  name={`equipmentName.${row.id}`}
                  required
                  maxLength={200}
                  placeholder="Example: Treadmill"
                />
              </Field>
              <Field label="Brand">
                <Select name={`equipmentBrand.${row.id}`} defaultValue="">
                  <option value="">Select brand</option>
                  {brands.map((brand) => (
                    <option key={brand.name} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Model Number">
                <Input name={`equipmentModel.${row.id}`} maxLength={200} />
              </Field>
              <Field label="Serial Number">
                <Input name={`equipmentSerial.${row.id}`} maxLength={200} />
              </Field>
              <div className="md:col-span-2 xl:col-span-4">
                <Field label="Problem Reported for This Equipment" required>
                  <Textarea
                    name={`equipmentProblem.${row.id}`}
                    required
                    maxLength={3000}
                    rows={3}
                    defaultValue={row.initialProblem}
                    placeholder="Describe the problem with this machine only."
                  />
                </Field>
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <Field label="Equipment Notes">
                  <Textarea
                    name={`equipmentNotes.${row.id}`}
                    maxLength={3000}
                    rows={2}
                    placeholder="Optional identification or location details."
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-accent bg-brand-faint/45 p-4">
          <div>
            <p className="text-sm font-semibold text-brand-ink">
              Does this visit include another machine?
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Add it now and register all equipment together.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={addRow}
            disabled={rows.length >= MAX_EQUIPMENT_PER_VISIT}
          >
            + Add Another Equipment
          </Button>
        </div>
      </div>
    </section>
  );
}
