"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";

export function WarrantyFields({
  defaultMonths = 12,
  defaultApplicable = true,
  defaultStartDate = "",
  defaultExpiryDate = "",
  defaultDuration,
  className = "md:col-span-2 xl:col-span-4",
  namePrefix = "",
}: {
  defaultMonths?: number;
  defaultApplicable?: boolean;
  defaultStartDate?: string;
  defaultExpiryDate?: string;
  defaultDuration?: string | null;
  className?: string;
  namePrefix?: string;
}) {
  const [warrantyApplicable, setWarrantyApplicable] =
    useState(defaultApplicable);
  const [months, setMonths] = useState(String(defaultMonths));
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate);
  const [durationText, setDurationText] = useState(
    defaultDuration || `${defaultMonths} Months`,
  );

  return (
    <div
      className={`${className} rounded-2xl border ${
        warrantyApplicable
          ? "border-brand-accent bg-brand-faint"
          : "border-brand-border bg-brand-subtle"
      } p-4`}
    >
      <label className="flex flex-col gap-3 text-sm font-semibold text-brand-ink sm:flex-row sm:items-start sm:justify-between">
        <span className="flex items-start gap-3">
        <input
          type="checkbox"
          name={`${namePrefix}warrantyApplicable`}
          checked={warrantyApplicable}
          onChange={(event) => setWarrantyApplicable(event.target.checked)}
          className="mt-1"
        />
        <span>
          Add warranty
          <span className="mt-1 block text-xs font-normal text-brand-muted">
            Select duration and start date. Expiry date will auto-fill.
          </span>
        </span>
        </span>
        {!warrantyApplicable && (
          <span className="inline-flex w-fit rounded-full bg-brand-border px-3 py-1 text-xs font-bold text-brand-secondary">
            No Warranty
          </span>
        )}
      </label>
      {!warrantyApplicable && (
        <p className="mt-3 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold text-brand-muted">
          This product will be saved without warranty details.
        </p>
      )}
      <div
        className={`mt-4 grid gap-4 md:grid-cols-4 ${
          warrantyApplicable ? "" : "hidden"
        }`}
      >
        <Field label="Quick Duration">
          <Select
            name={`${namePrefix}warrantyMonths`}
            value={months}
            onChange={(event) => {
              const value = event.target.value;
              setMonths(value);
              setDurationText(`${value} Months`);
              if (startDate) setExpiryDate(addMonths(startDate, Number(value)));
            }}
            disabled={!warrantyApplicable}
          >
            {![3, 6, 12, 24, 36].includes(defaultMonths) && (
              <option value={defaultMonths}>{defaultMonths} Months</option>
            )}
            <option value="3">3 Months</option>
            <option value="6">6 Months</option>
            <option value="12">12 Months</option>
            <option value="24">24 Months</option>
            <option value="36">36 Months</option>
          </Select>
        </Field>
        <Field label="Warranty Start">
          <Input
            name={`${namePrefix}warrantyStartDate`}
            type="date"
            value={startDate}
            onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              setExpiryDate(value ? addMonths(value, Number(months)) : "");
            }}
            disabled={!warrantyApplicable}
          />
        </Field>
        <Field label="Warranty Expiry">
          <Input
            name={`${namePrefix}warrantyExpiryDate`}
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
            disabled={!warrantyApplicable}
          />
        </Field>
        <Field label="Warranty Text">
          <Input
            name={`${namePrefix}warrantyDuration`}
            value={durationText}
            onChange={(event) => setDurationText(event.target.value)}
            disabled={!warrantyApplicable}
          />
        </Field>
      </div>
    </div>
  );
}

function addMonths(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  let date = new Date(year, month - 1 + months, day);
  if (date.getDate() !== day) {
    date = new Date(year, month + months, 0);
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

