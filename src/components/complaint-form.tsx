"use client";
import { dateInput, dateBoundary } from "@/lib/business-date";
import { ActionForm } from "@/components/action-form";

import { useMemo, useState } from "react";
import { createComplaint } from "@/actions/complaint";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { titleCase } from "@/lib/format";
import { EquipmentSelect } from "@/components/equipment-select";
import { equipmentLabel } from "@/lib/equipment-label";

type Customer = {
  id: string;
  name: string;
  primaryMobile: string;
  address: string;
  city: string;
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
  const [equipmentMode, setEquipmentMode] = useState(
    initialEquipmentId ? "existing" : "unknown",
  );
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(
    initialEquipmentId ?? "",
  );

  const customer = customers.find((c) => c.id === customerId);
  const filteredEquipment = useMemo(
    () => equipment.filter((item) => item.customerId === customerId),
    [equipment, customerId],
  );
  const isExistingCustomer = customerMode === "existing";
  const isNewCustomer = customerMode === "new";
  const canUseExistingEquipment =
    isExistingCustomer && filteredEquipment.length > 0;

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
            text="Select from customer master."
            onClick={() => {
              setCustomerMode("existing");
            }}
          />
          <ModeButton
            active={isNewCustomer}
            title="New Customer"
            text="Create customer while registering this complaint."
            onClick={() => {
              setCustomerMode("new");
              setCustomerId("");
              setSelectedEquipmentId("");
              if (equipmentMode === "existing") setEquipmentMode("unknown");
            }}
          />
        </div>
      </div>

      {isExistingCustomer ? (
        <div key="existing-customer-fields" className="contents">
          <Field label="Customer" required>
            <Select
              name="customerId"
              required
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setSelectedEquipmentId("");
                setEquipmentMode("unknown");
              }}
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
            <Input readOnly value={customer?.primaryMobile ?? ""} />
          </Field>
          <Field label="Customer Address">
            <Input
              readOnly
              value={customer ? `${customer.address}, ${customer.city}` : ""}
            />
          </Field>
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
            <Input
              name="newCustomerPrimaryMobile"
              required={isNewCustomer}
              inputMode="tel"
            />
          </Field>
          <Field label="Alternate Mobile">
            <Input name="newCustomerAlternateMobile" inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input name="newCustomerEmail" type="email" />
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Address" required>
              <Textarea
                name="newCustomerAddress"
                required={isNewCustomer}
                rows={2}
              />
            </Field>
          </div>
          <Field label="City" required>
            <Input name="newCustomerCity" required={isNewCustomer} />
          </Field>
          <Field label="State" required>
            <Input
              name="newCustomerState"
              required={isNewCustomer}
              defaultValue="Tamil Nadu"
            />
          </Field>
          <Field label="PIN Code" required>
            <Input name="newCustomerPinCode" required={isNewCustomer} />
          </Field>
          <Field label="GST Number">
            <Input name="newCustomerGstNumber" />
          </Field>
          <Field label="Customer Notes">
            <Input name="newCustomerNotes" />
          </Field>
        </div>
      )}

      <div className="md:col-span-2 xl:col-span-3">
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-brand-ink">Equipment</h2>
            <p className="mt-0.5 text-sm text-brand-muted">
              Link existing equipment, or continue if the
              customer does not know the details during the call.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <ModeButton
              active={equipmentMode === "existing"}
              title="Existing Equipment"
              text={
                canUseExistingEquipment
                  ? "Use customer equipment."
                  : "Select a customer with equipment."
              }
              disabled={!canUseExistingEquipment}
              onClick={() => setEquipmentMode("existing")}
            />
            <ModeButton
              active={equipmentMode === "unknown"}
              title="Not Known"
              text="Complaint can be assigned first."
              onClick={() => {
                setEquipmentMode("unknown");
                setSelectedEquipmentId("");
              }}
            />
          </div>
        </div>
      </div>

      {equipmentMode === "existing" && (
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Existing Equipment" required>
            <EquipmentSelect
              name="equipmentId"
              required
              value={selectedEquipmentId}
              onChange={(event) => setSelectedEquipmentId(event.target.value)}
              options={filteredEquipment.map(item => ({ value: item.id, label: equipmentLabel(item) }))}
            />
          </Field>
        </div>
      )}

      <div className="md:col-span-2 xl:col-span-3 border-t border-brand-border pt-5" />

      <Field label="Complaint Date">
        <Input
          name="complaintDate"
          type="date"
          defaultValue={dateInput()}
        />
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
      <Field label="Technician" hint={canAssign ? "Choose now or assign later from Teams." : "Your account does not have assignment permission."}>
        <Select name="technicianId" disabled={!canAssign} defaultValue="">
          <option value="">Assign later</option>
          {technicians.map(technician => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
        </Select>
      </Field>
      <div className="md:col-span-2 xl:col-span-3">
        <Field label="Office Notes">
          <Textarea name="notes" />
        </Field>
      </div>
      <div className="md:col-span-2 xl:col-span-3">
        <Button type="submit">Register Complaint</Button>
      </div>
    </ActionForm>
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


