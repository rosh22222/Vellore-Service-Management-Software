"use client";

import { useMemo, useState } from "react";
import { createComplaint } from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { PinCodeInput } from "@/components/ui/pin-code-input";
import { StateCitySelects } from "@/components/state-city-selects";
import { dateInput } from "@/lib/business-date";
import { equipmentLabel } from "@/lib/equipment-label";
import { titleCase } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  primaryMobile: string;
  address: string;
  city: string;
  invoiceNumbers: string[];
};

type Equipment = {
  id: string;
  equipmentCode: string;
  customerId: string;
  name: string;
  modelNumber: string | null;
  serialNumber: string | null;
};

export function ComplaintForm({
  customers,
  equipment,
  customerTypes,
  initialCustomerId,
  initialEquipmentId,
  priorities,
  sources,
  technicians = [],
  canAssign = false,
}: {
  customers: Customer[];
  equipment: Equipment[];
  customerTypes: string[];
  initialCustomerId?: string;
  initialEquipmentId?: string;
  priorities: string[];
  sources: string[];
  technicians?: { id: string; name: string }[];
  canAssign?: boolean;
}) {
  const [customerMode, setCustomerMode] = useState(
    customers.length ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [equipmentMode, setEquipmentMode] = useState(
    initialEquipmentId ||
      (initialCustomerId &&
        equipment.some((item) => item.customerId === initialCustomerId))
      ? "existing"
      : "unknown",
  );
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>(
    initialEquipmentId ? [initialEquipmentId] : [],
  );
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<string[]>([]);

  const customer = customers.find((item) => item.id === customerId);
  const filteredEquipment = useMemo(
    () => equipment.filter((item) => item.customerId === customerId),
    [equipment, customerId],
  );
  const matchingCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    const matches = query
      ? customers.filter((item) =>
          [item.name, item.primaryMobile, ...item.invoiceNumbers].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : customers.slice(0, 50);
    const selected = customers.find((item) => item.id === customerId);
    const limited = matches.slice(0, 80);
    return selected && !limited.some((item) => item.id === selected.id)
      ? [selected, ...limited]
      : limited;
  }, [customerId, customerSearch, customers]);

  const isExistingCustomer = customerMode === "existing";
  const isNewCustomer = customerMode === "new";
  const canUseExistingEquipment =
    isExistingCustomer && filteredEquipment.length > 0;

  function chooseCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setSelectedEquipmentIds([]);
    const hasEquipment = equipment.some(
      (item) => item.customerId === nextCustomerId,
    );
    setEquipmentMode(hasEquipment ? "existing" : "unknown");
  }

  function searchCustomers(value: string) {
    setCustomerSearch(value);
    const query = value.trim().toLowerCase();
    if (query.length < 3) return;
    const matches = customers.filter((item) =>
      [item.name, item.primaryMobile, ...item.invoiceNumbers].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
    if (matches.length === 1) chooseCustomer(matches[0].id);
  }

  function toggleEquipment(id: string) {
    setSelectedEquipmentIds((current) =>
      current.includes(id)
        ? current.filter((equipmentId) => equipmentId !== id)
        : [...current, id],
    );
  }

  function toggleTechnician(id: string) {
    setSelectedTechnicianIds((current) =>
      current.includes(id)
        ? current.filter((technicianId) => technicianId !== id)
        : [...current, id],
    );
  }

  return (
    <ActionForm
      action={createComplaint}
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <input type="hidden" name="customerMode" value={customerMode} />
      <input type="hidden" name="equipmentMode" value={equipmentMode} />

      <div className="md:col-span-2 xl:col-span-3">
        <div className="grid gap-2 rounded-2xl bg-brand-subtle p-2 sm:grid-cols-2">
          <ModeButton
            active={isExistingCustomer}
            title="Existing Customer"
            text="Use a customer already saved from a bill or earlier service."
            onClick={() => setCustomerMode("existing")}
          />
          <ModeButton
            active={isNewCustomer}
            title="New Customer"
            text="Create a first-time VFE or external-equipment service customer."
            onClick={() => {
              setCustomerMode("new");
              setCustomerId("");
              setCustomerSearch("");
              setSelectedEquipmentIds([]);
              if (equipmentMode === "existing") setEquipmentMode("unknown");
            }}
          />
        </div>
      </div>

      {isExistingCustomer ? (
        <div key="existing-customer-fields" className="md:col-span-2 xl:col-span-3">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Find Customer"
              hint="Search by customer name, 10-digit phone number or invoice number."
            >
              <Input
                type="search"
                value={customerSearch}
                onChange={(event) => searchCustomers(event.target.value)}
                placeholder="Start typing name, phone or invoice no."
                autoComplete="off"
              />
            </Field>
            <Field
              label="Customer"
              required
              hint={`${matchingCustomers.length} customer${matchingCustomers.length === 1 ? "" : "s"} shown`}
            >
              <Select
                name="customerId"
                required
                value={customerId}
                onChange={(event) => chooseCustomer(event.target.value)}
              >
                <option value="">Select customer</option>
                {matchingCustomers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.city ? ` — ${item.city}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {customer && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-brand-border bg-brand-faint p-4 sm:grid-cols-3">
              <CustomerDetail label="Phone" value={customer.primaryMobile} />
              <CustomerDetail
                label="Invoice No."
                value={customer.invoiceNumbers.slice(0, 3).join(", ") || "No bill reference"}
              />
              <CustomerDetail
                label="Address"
                value={`${customer.address}, ${customer.city}`}
              />
            </div>
          )}
        </div>
      ) : (
        <div key="new-customer-fields" className="contents">
          <Field label="Customer Type" required>
            <Select name="newCustomerType" required={isNewCustomer} defaultValue="">
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
            <Input name="newCustomerName" required={isNewCustomer} />
          </Field>
          <Field label="Primary Mobile" required>
            <PhoneInput name="newCustomerPrimaryMobile" required={isNewCustomer} />
          </Field>
          <Field label="Alternate Mobile">
            <PhoneInput name="newCustomerAlternateMobile" />
          </Field>
          <Field label="Email">
            <Input name="newCustomerEmail" type="email" />
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Address" required>
              <Textarea name="newCustomerAddress" required={isNewCustomer} rows={2} />
            </Field>
          </div>
          <StateCitySelects
            stateName="newCustomerState"
            cityName="newCustomerCity"
            defaultState=""
            defaultCity=""
            required={isNewCustomer}
          />
          <Field label="PIN Code" required>
            <PinCodeInput name="newCustomerPinCode" required={isNewCustomer} />
          </Field>
          <Field label="GST Number">
            <Input name="newCustomerGstNumber" />
          </Field>
        </div>
      )}

      <div className="md:col-span-2 xl:col-span-3">
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-brand-ink">Equipment</h2>
            <p className="mt-0.5 text-sm text-brand-muted">
              Select registered machine(s). For external equipment, create the
              complaint now and identify the machine at the visit.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <ModeButton
              active={equipmentMode === "existing"}
              title="Registered Equipment"
              text={
                canUseExistingEquipment
                  ? "Select one or more customer machines."
                  : "Select a customer with equipment."
              }
              disabled={!canUseExistingEquipment}
              onClick={() => setEquipmentMode("existing")}
            />
            <ModeButton
              active={equipmentMode === "unknown"}
              title="Equipment Not Yet Registered"
              text="Office staff or the assigned technician can register and link it at the visit."
              onClick={() => {
                setEquipmentMode("unknown");
                setSelectedEquipmentIds([]);
              }}
            />
          </div>
        </div>
      </div>

      {equipmentMode === "existing" && (
        <div className="md:col-span-2 xl:col-span-3">
          <Field
            label="Registered Equipment"
            required
          >
            <Select
              name="equipmentIds"
              multiple
              required
              value={selectedEquipmentIds}
              onChange={() => undefined}
              aria-label="Selected equipment"
              className="sr-only"
            >
              {filteredEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {equipmentLabel(item)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-2 rounded-2xl border border-brand-border bg-brand-faint p-4">
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {filteredEquipment.map((item) => {
                const selected = selectedEquipmentIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      selected
                        ? "border-brand-primary bg-brand-soft text-brand-ink"
                        : "border-brand-border bg-white hover:border-brand-primary"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleEquipment(item.id)}
                      className="mt-0.5 h-4 w-4 accent-brand-primary"
                    />
                    <span className="min-w-0 text-sm font-medium">
                      {equipmentLabel(item)}
                    </span>
                  </label>
                );
              })}
              {filteredEquipment.length === 0 && (
                <div className="rounded-xl border border-dashed border-brand-border bg-white p-4 text-sm text-brand-muted md:col-span-2">
                  No equipment is registered for this customer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="md:col-span-2 xl:col-span-3 border-t border-brand-border pt-5" />

      <Field label="Complaint Date">
        <Input name="complaintDate" type="date" defaultValue={dateInput()} />
      </Field>
      <Field label="Problem Type">
        <Input
          name="complaintCategory"
          placeholder="Noise / Belt / Electrical / Display..."
        />
      </Field>
      <Field label="Priority">
        <Select name="priority" defaultValue="NORMAL">
          {priorities.map((value) => (
            <option key={value} value={value}>
              {titleCase(value)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="md:col-span-2 xl:col-span-3">
        <Field
          label="Customer Complaint / Problem Reported"
          required
          hint="Keep exactly what the customer reported. Technician diagnosis is stored separately."
        >
          <Textarea
            name="customerComplaint"
            required
            placeholder="Treadmill stops automatically after approximately 10 minutes."
          />
        </Field>
      </div>

      <Field label="Complaint Source">
        <Select name="source" defaultValue="PHONE">
          {sources.map((value) => (
            <option key={value} value={value}>
              {titleCase(value)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Preferred Visit Date">
        <Input name="preferredVisitDate" type="date" />
      </Field>

      <div className="md:col-span-2 xl:col-span-3">
        <div className="space-y-2 text-[13px] font-medium text-brand-secondary">
          <div>Technicians</div>
          <div className="grid gap-2 rounded-2xl border border-brand-border bg-brand-faint p-4 sm:grid-cols-2 lg:grid-cols-3">
            {canAssign && technicians.length ? (
              technicians.map((technician) => {
                const selected = selectedTechnicianIds.includes(technician.id);
                return (
                  <label
                    key={technician.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition ${
                      selected
                        ? "border-brand-primary bg-brand-soft text-brand-ink"
                        : "border-brand-border bg-white hover:border-brand-primary"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="technicianIds"
                      value={technician.id}
                      checked={selected}
                      onChange={() => toggleTechnician(technician.id)}
                      className="h-4 w-4 accent-brand-primary"
                    />
                    {technician.name}
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-brand-muted sm:col-span-2 lg:col-span-3">
                {canAssign
                  ? "No available technicians. You can assign one later from Teams."
                  : "Technician assignment is unavailable for this account."}
              </p>
            )}
          </div>
          <p className="text-xs font-normal text-brand-muted">
            {canAssign
              ? `${selectedTechnicianIds.length} selected. Leave empty to assign later from Teams.`
              : "Your account does not have assignment permission."}
          </p>
        </div>
      </div>

      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Office Notes">
          <Textarea name="notes" />
        </Field>
      </div>
      <div className="md:col-span-2 xl:col-span-3">
        <Button
          type="submit"
          disabled={equipmentMode === "existing" && selectedEquipmentIds.length === 0}
        >
          {selectedEquipmentIds.length > 1
            ? `Register ${selectedEquipmentIds.length} Complaints`
            : "Register Complaint"}
        </Button>
      </div>
    </ActionForm>
  );
}

function CustomerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-brand-ink">
        {value}
      </div>
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
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-brand-border bg-white text-brand-secondary hover:border-brand-input"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div
        className={`mt-0.5 text-xs ${
          active ? "text-brand-border" : "text-brand-muted"
        }`}
      >
        {text}
      </div>
    </button>
  );
}
