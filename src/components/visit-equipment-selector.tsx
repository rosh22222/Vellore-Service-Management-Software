"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/form";

type EquipmentOption = {
  value: string;
  label: string;
};

export function VisitEquipmentSelector({
  options,
}: {
  options: EquipmentOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((equipmentId) => equipmentId !== id)
        : [...current, id],
    );
  }

  return (
    <div className="space-y-4">
      <select
        name="equipmentIds"
        multiple
        required
        value={selectedIds}
        onChange={() => undefined}
        aria-label="Selected equipment for this visit"
        className="sr-only"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => {
          const selected = selectedIds.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                selected
                  ? "border-brand-primary bg-brand-soft"
                  : "border-brand-border bg-white hover:border-brand-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
              />
              <span className="min-w-0 break-words text-sm font-medium text-brand-ink">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-brand-accent/55 bg-brand-faint/55 p-4">
          <div>
            <h4 className="text-sm font-semibold text-brand-ink">
              Describe Each Machine&apos;s Problem
            </h4>
            <p className="mt-1 text-xs leading-5 text-brand-muted">
              {selectedIds.length} machine{selectedIds.length === 1 ? "" : "s"}{" "}
              selected. Each one will receive a separate complaint number.
            </p>
          </div>
          {selectedIds.map((id, index) => {
            const option = options.find((item) => item.value === id);
            return (
              <label key={id} className="block rounded-xl border border-brand-border bg-white p-3">
                <span className="mb-2 block text-xs font-semibold text-brand-secondary">
                  {index + 1}. {option?.label}
                  <span className="ml-1 text-rose-600">*</span>
                </span>
                <Textarea
                  name={`equipmentProblem.${id}`}
                  required
                  rows={2}
                  placeholder="Problem reported for this machine"
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
