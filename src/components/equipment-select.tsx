"use client";
import { useState, type SelectHTMLAttributes } from "react";
import { Select } from "@/components/ui/form";

export function EquipmentSelect({ options, placeholder = "Select equipment", value, defaultValue, onChange, ...props }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "multiple" | "value" | "defaultValue"> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const current = value ?? selected;
  const label = options.find(option => option.value === current)?.label;
  return <div className="min-w-0 space-y-2">
    <Select {...props} aria-label={props["aria-label"] ?? "Equipment"} value={current} title={label ?? placeholder} onChange={event => { setSelected(event.target.value); onChange?.(event); }}>
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option.value} value={option.value} title={option.label}>{option.label}</option>)}
    </Select>
    {label && <span aria-live="polite" className="block whitespace-normal break-words rounded-lg border border-brand-border bg-brand-faint px-3 py-2 text-xs font-normal leading-5 text-brand-secondary">{label}</span>}
  </div>;
}
