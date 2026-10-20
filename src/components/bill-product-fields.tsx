"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { WarrantyFields } from "@/components/warranty-fields";
import { useId, useState } from "react";
import { MAX_PRODUCT_QUANTITY, MAX_KG_QUANTITY, QUANTITY_REQUIRED_MESSAGE, readQuantityUnit, type ProductQuantityUnit } from "@/lib/bill-quantity";

export type BillProductDefaultValues = {
  itemName?: string;
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  quantity?: string | number | null;
  quantityUnit?: ProductQuantityUnit;
  unitPrice?: string | number | null;
  installationDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyExpiryDate?: string | null;
  warrantyDuration?: string | null;
  itemNotes?: string | null;
  units?: { equipmentId: string; equipmentCode: string; serialNumber: string | null; updatedAt: string }[];
};

export function BillProductFields({
  namePrefix = "",
  defaults = {},
  brandOptions = [],
}: {
  namePrefix?: string;
  defaults?: BillProductDefaultValues;
  brandOptions?: string[];
}) {
  const [quantity, setQuantity] = useState(defaults.quantity?.toString() ?? "");
  const [quantityUnit, setQuantityUnit] = useState<ProductQuantityUnit>(defaults.quantityUnit ?? "UNIT");
  const isKg = quantityUnit === "KG";
  const quantityId = useId();
  const [serials, setSerials] = useState<string[]>(() => defaults.units?.map(unit => unit.serialNumber ?? "") ?? [defaults.serialNumber ?? ""]);
  const count = Number(quantity);
  const machineCount = Number.isSafeInteger(count) && count > 0 && count <= MAX_PRODUCT_QUANTITY ? count : 1;
  const warrantyMonths = readWarrantyMonths(defaults.warrantyDuration);
  const hasWarranty =
    Boolean(defaults.warrantyStartDate) ||
    Boolean(defaults.warrantyExpiryDate) ||
    Boolean(defaults.warrantyDuration);
  const brands = Array.from(
    new Set(
      [defaults.brand, ...brandOptions]
        .map((brand) => brand?.trim())
        .filter((brand): brand is string => Boolean(brand)),
    ),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Product / Equipment Name" required>
        <Input
          name={`${namePrefix}itemName`}
          required
          defaultValue={defaults.itemName ?? ""}
          placeholder="Treadmill"
        />
      </Field>
      <Field
        label="Brand"
        required
        hint={brands.length ? undefined : "Add brands from the Brands page first."}
      >
        <Select
          name={`${namePrefix}brand`}
          required
          defaultValue={defaults.brand ?? ""}
        >
          <option value="" disabled>
            Select brand
          </option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Model Number">
        <Input
          name={`${namePrefix}modelNumber`}
          defaultValue={defaults.modelNumber ?? ""}
        />
      </Field>
      <Field label="Quantity" required htmlFor={quantityId} hint={isKg ? "Enter the total weight in Kg. No individual serial numbers are needed." : "Each machine gets its own equipment ID and repair history."}>
        <div className="flex rounded-xl">
          <Input
            key={quantityUnit}
            id={quantityId}
            aria-label="Quantity"
            name={`${namePrefix}quantity`}
            type="number"
            step={isKg ? "0.01" : "1"}
            min={isKg ? "0.01" : "1"}
            max={isKg ? MAX_KG_QUANTITY : MAX_PRODUCT_QUANTITY}
            required
            placeholder="Enter quantity"
            className="!rounded-r-none !border-r-0 focus:z-10"
            value={quantity}
            onInvalid={event => {
              const input = event.currentTarget;
              input.setCustomValidity(input.validity.valueMissing ? QUANTITY_REQUIRED_MESSAGE : "");
            }}
            onChange={event => {
              event.currentTarget.setCustomValidity("");
              setQuantity(event.target.value);
            }}
          />
          <Select
            name={`${namePrefix}quantityUnit`}
            aria-label="Quantity unit"
            required
            value={quantityUnit}
            onChange={event => setQuantityUnit(readQuantityUnit(event.target.value))}
            className="!w-24 shrink-0 !rounded-l-none !px-2 focus:z-10"
          >
            <option value="UNIT">Unit</option>
            <option value="KG">Kg</option>
          </Select>
        </div>
      </Field>

      {defaults.units && <input type="hidden" name={`${namePrefix}existingUnits`} value={defaults.units.map(unit => `${unit.equipmentId}:${unit.updatedAt}`).join(",")} />}
      {!isKg && <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-brand-border bg-white p-4">
        <p className="text-sm font-semibold text-brand-ink">{machineCount === 1 ? "Machine Identification" : `Individual Machines (${machineCount})`}</p>
        <p className="mb-3 mt-1 text-xs leading-5 text-brand-muted">Serial numbers are optional. Without a serial, use the unique equipment ID shown after saving to identify each machine.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: machineCount }, (_, index) => (
            <Field key={index} label={machineCount === 1 ? "Serial Number" : `Machine ${index + 1} - Serial Number`} hint={defaults.units?.[index]?.equipmentCode}>
              <Input
                name={index === 0 ? `${namePrefix}serialNumber` : `${namePrefix}unitSerialNumbers.${index}`}
                value={serials[index] ?? ""}
                onChange={event => {
                  const value = event.target.value;
                  setSerials(previous => { const next = [...previous]; next[index] = value; return next; });
                }}
                maxLength={120}
                placeholder="Enter serial number, if available"
              />
            </Field>
          ))}
        </div>
      </div>}
      <Field label={isKg ? "Price per Kg (₹)" : "Unit Price (₹)"} required>
        <Input
          name={`${namePrefix}unitPrice`}
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={defaults.unitPrice?.toString() ?? ""}
          placeholder="0.00"
        />
      </Field>
      <Field label="Installation Date">
        <Input
          name={`${namePrefix}installationDate`}
          type="date"
          defaultValue={defaults.installationDate ?? ""}
        />
      </Field>

      <WarrantyFields
        defaultApplicable={hasWarranty}
        defaultMonths={warrantyMonths}
        defaultStartDate={defaults.warrantyStartDate ?? ""}
        defaultExpiryDate={defaults.warrantyExpiryDate ?? ""}
        defaultDuration={defaults.warrantyDuration}
        namePrefix={namePrefix}
      />

      <div className="md:col-span-2 xl:col-span-4">
        <Field label="Item Notes">
          <Textarea
            name={`${namePrefix}itemNotes`}
            rows={2}
            defaultValue={defaults.itemNotes ?? ""}
            placeholder="Accessories supplied, special customer instruction, etc."
          />
        </Field>
      </div>
    </div>
  );
}

function readWarrantyMonths(value?: string | null) {
  const match = value?.match(/\d+/);
  if (!match) return 12;
  return Math.max(1, Number(match[0]) || 12);
}
