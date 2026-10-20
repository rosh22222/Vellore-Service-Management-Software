"use client";
import { dateInput, dateBoundary } from "@/lib/business-date";
import { ActionForm } from "@/components/action-form";

import { useState } from "react";
import { Plus, Package, Trash2 } from "lucide-react";
import { createBillDetail, updateCompleteBill } from "@/actions/bill-detail";
import { BillProductFields, type BillProductDefaultValues } from "@/components/bill-product-fields";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { titleCase } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  primaryMobile: string;
  city: string;
};

type ProductRow = {
  id: string;
  itemId?: string;
  defaults?: BillProductDefaultValues;
};

export type BillEditDefaults = {
  id: string; billDate: string; billVersion: string;
  customer: { name: string; type: string; primaryMobile: string; alternateMobile: string | null; email: string | null; address: string; city: string; state: string; pinCode: string | null; gstNumber: string | null; notes: string | null; updatedAt: string };
  products: ProductRow[];
};

export function BillDetailForm({
  customers,
  customerTypes,
  initialBillNumber,
  brandOptions,
  editing,
}: {
  customers: Customer[];
  customerTypes: string[];
  initialBillNumber: string;
  brandOptions: string[];
  editing?: BillEditDefaults;
}) {
  const [customerMode, setCustomerMode] = useState(
    editing ? "new" : customers.length ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState("");
  const [productRows, setProductRows] = useState<ProductRow[]>(editing?.products ?? [
    { id: "initial-product" },
  ]);
  const customer = customers.find((item) => item.id === customerId);
  const isExistingCustomer = customerMode === "existing";
  const isNewCustomer = customerMode === "new";

  const addProductRow = () => {
    setProductRows((rows) => [
      ...rows,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    ]);
  };

  const removeProductRow = (id: string) => {
    setProductRows((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.id !== id),
    );
  };

  return (
    <ActionForm
      action={editing ? updateCompleteBill.bind(null, editing.id) : createBillDetail}
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
    >
      <input type="hidden" name="customerMode" value={customerMode} />
      <input type="hidden" name="productCount" value={productRows.length} />
      <input type="hidden" name="suggestedBillNumber" value={initialBillNumber} />
      {editing && <><input type="hidden" name="billVersion" value={editing.billVersion} /><input type="hidden" name="customerVersion" value={editing.customer.updatedAt} /></>}

      <Field label="Invoice No." required>
        <Input
          name="billNumber"
          required
          defaultValue={initialBillNumber}
          placeholder="Example: VFE-INV-0001"
        />
      </Field>
      <Field label="Bill / Purchase Date" required={Boolean(editing)}>
        <Input
          name="billDate"
          type="date"
          defaultValue={editing?.billDate ?? dateInput()}
          required={Boolean(editing)}
        />
      </Field>

      {!editing && <div className="md:col-span-2 xl:col-span-4">
        <div className="grid gap-2 rounded-2xl border border-brand-border bg-brand-subtle p-1.5 sm:grid-cols-2">
          <ModeButton
            active={isExistingCustomer}
            title="Existing Customer"
            text="Select a saved customer."
            disabled={!customers.length}
            onClick={() => setCustomerMode("existing")}
          />
          <ModeButton
            active={isNewCustomer}
            title="New Customer"
            text="Create customer from this bill reference."
            onClick={() => {
              setCustomerMode("new");
              setCustomerId("");
            }}
          />
        </div>
      </div>}
      {editing && <p className="md:col-span-2 xl:col-span-4 text-sm text-brand-muted">Edit the customer profile and every product below, then save all changes together. Customer changes also update the saved customer profile.</p>}

      {isExistingCustomer ? (
        <>
          <Field label="Customer" required>
            <Select
              name="customerId"
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.primaryMobile}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer Phone">
            <ReadonlyValue value={customer?.primaryMobile} />
          </Field>
          <Field label="City">
            <ReadonlyValue value={customer?.city} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Customer Type" required>
            <Select name="newCustomerType" required={isNewCustomer} defaultValue={editing?.customer.type ?? ""}>
              <option value="" disabled>
                Please select type
              </option>
              {customerTypes.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer / Gym Name" required>
            <Input name="newCustomerName" required={isNewCustomer} defaultValue={editing?.customer.name ?? ""} />
          </Field>
          <Field label="Primary Mobile" required>
            <Input
              name="newCustomerPrimaryMobile"
              defaultValue={editing?.customer.primaryMobile ?? ""}
              required={isNewCustomer}
              inputMode="tel"
            />
          </Field>
          <Field label="Alternate Mobile">
            <Input name="newCustomerAlternateMobile" inputMode="tel" defaultValue={editing?.customer.alternateMobile ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="newCustomerEmail" type="email" defaultValue={editing?.customer.email ?? ""} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Address" required>
              <Textarea
                name="newCustomerAddress"
                defaultValue={editing?.customer.address ?? ""}
                required={isNewCustomer}
                rows={2}
              />
            </Field>
          </div>
          <Field label="City" required>
            <Input name="newCustomerCity" required={isNewCustomer} defaultValue={editing?.customer.city ?? ""} />
          </Field>
          <Field label="State" required>
            <Input
              name="newCustomerState"
              required={isNewCustomer}
              defaultValue={editing?.customer.state ?? "Tamil Nadu"}
            />
          </Field>
          <Field label="PIN Code" required>
            <Input name="newCustomerPinCode" required={isNewCustomer} defaultValue={editing?.customer.pinCode ?? ""} />
          </Field>
          <Field label="GST Number">
            <Input name="newCustomerGstNumber" defaultValue={editing?.customer.gstNumber ?? ""} />
          </Field>
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Customer Notes">
              <Textarea
                name="newCustomerNotes"
                defaultValue={editing?.customer.notes ?? ""}
                rows={3}
                placeholder="Enter customer notes or special instructions..."
              />
            </Field>
          </div>
        </>
      )}

      <div className="border-t border-brand-border pt-5 md:col-span-2 xl:col-span-4">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-brand-ink">
          <Package size={18} className="text-brand-primary" />
          Products in this Bill
        </h3>
        <p className="mt-1 text-sm text-brand-muted">
          Add all products from the same customer bill here before saving.
        </p>
      </div>

      <div className="md:col-span-2 xl:col-span-4">
        <div className="space-y-4">
          {productRows.map((row, index) => (
            <ProductCard
              key={row.id}
              index={index}
              brandOptions={brandOptions}
              row={row}
              canRemove={productRows.length > 1}
              onRemove={() => removeProductRow(row.id)}
            />
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-brand-warm/80 bg-brand-warm-soft/65">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-brand-ink">
                Add Another Product
              </h4>
              <p className="mt-1 text-xs leading-5 text-brand-muted">
                Use this when the same customer bill contains multiple products.
              </p>
            </div>
            <Button
              type="button"
              onClick={addProductRow}
              className="px-5"
            >
              <Plus size={17} /> Add Another Product
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-brand-border pt-5 md:col-span-2 xl:col-span-4">
        <p aria-live="polite" className="text-xs text-brand-muted">{productRows.length} {productRows.length === 1 ? "product" : "products"} in this bill</p>
        <Button type="submit" loadingText="Saving bill details...">
          {editing ? "Save All Changes" : "Save Bill Details"}
        </Button>
      </div>
    </ActionForm>
  );
}

function ProductCard({
  index,
  brandOptions,
  canRemove,
  onRemove,
  row,
}: {
  index: number;
  brandOptions: string[];
  canRemove: boolean;
  onRemove: () => void;
  row: ProductRow;
}) {
  const prefix = `items.${index}.`;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-subtle/75 p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-brand-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-xs text-brand-primary">{index + 1}</span>
            Product Details
          </h4>
          <p className="mt-1 text-xs text-brand-muted">
            Equipment details, warranty and product notes for this bill item.
          </p>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Trash2 size={14} /> Remove Product
          </button>
        )}
      </div>

      <input type="hidden" name={`${prefix}itemId`} value={row.itemId ?? ""} />
      <BillProductFields namePrefix={prefix} brandOptions={brandOptions} defaults={row.defaults} />
    </div>
  );
}

function ReadonlyValue({ value }: { value?: string | null }) {
  return (
    <div className="min-h-[42px] w-full rounded-lg border border-brand-border bg-brand-subtle px-3.5 py-2.5 text-sm text-brand-ink">
      {value || "Select customer"}
    </div>
  );
}

function ModeButton({
  active,
  title,
  text,
  disabled = false,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-brand-accent bg-brand-soft text-brand-primary shadow-sm"
          : "border-brand-border bg-white text-brand-ink hover:border-brand-accent"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div
        className={`mt-0.5 text-xs ${
          active ? "text-brand-primary" : "text-brand-muted"
        }`}
      >
        {text}
      </div>
    </button>
  );
}

