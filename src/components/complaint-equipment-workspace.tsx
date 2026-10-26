import Link from "next/link";
import {
  addComplaintEquipmentServiceFromForm,
  linkComplaintEquipmentFromForm,
} from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { EquipmentSelect } from "@/components/equipment-select";
import { VisitEquipmentSelector } from "@/components/visit-equipment-selector";
import { VisitServiceActions } from "@/components/visit-service-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { equipmentLabel } from "@/lib/equipment-label";

type EquipmentOption = {
  id: string;
  name: string;
  modelNumber: string | null;
  serialNumber: string | null;
};

type BrandOption = { name: string };

type VisitService = {
  id: string;
  complaintNumber: string;
  customerComplaint: string;
  status: string;
  equipment: {
    name: string;
    brand: string | null;
    modelNumber: string | null;
    serialNumber: string | null;
    notes: string | null;
  } | null;
};

export function ComplaintEquipmentWorkspace({
  complaintId,
  equipment,
  brands,
  currentEquipmentId,
  canAdd = true,
  canDelete = false,
  visitServices,
  detailBasePath,
  addedCount = 0,
  equipmentUpdated = false,
  equipmentDeleted = false,
}: {
  complaintId: string;
  equipment: EquipmentOption[];
  brands: BrandOption[];
  currentEquipmentId: string | null;
  canAdd?: boolean;
  canDelete?: boolean;
  visitServices: VisitService[];
  detailBasePath: "/complaints" | "/jobs";
  addedCount?: number;
  equipmentUpdated?: boolean;
  equipmentDeleted?: boolean;
}) {
  const equipmentOptions = equipment.map((item) => ({
    value: item.id,
    label: equipmentLabel(item),
  }));
  const otherEquipmentOptions = equipmentOptions.filter(
    (item) => item.value !== currentEquipmentId,
  );
  const visitSummary = (
    <VisitServiceList
      services={visitServices}
      currentComplaintId={complaintId}
      detailBasePath={detailBasePath}
      brands={brands}
      canManage={canAdd}
      canDelete={canDelete}
    />
  );
  const changeNotices = (
    <>
      {equipmentUpdated && (
        <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Equipment service updated successfully.
        </AutoDismissNotice>
      )}
      {equipmentDeleted && (
        <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Equipment service removed from this visit.
        </AutoDismissNotice>
      )}
    </>
  );

  if (!canAdd) return visitSummary;

  if (!currentEquipmentId) {
    return (
      <>
        {addedCount > 0 && (
          <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {addedCount} equipment service job{addedCount === 1 ? "" : "s"} added to this visit.
          </AutoDismissNotice>
        )}
        {changeNotices}
        {visitSummary}
        <Card className="mt-6 border-brand-accent/70">
          <CardHeader
            title="Identify Equipment"
            subtitle="Choose a registered machine, or register external equipment that was not purchased from Vellore Fitness Equipment."
          />
          <CardBody className="space-y-5">
            {equipmentOptions.length > 0 && (
              <section className="rounded-2xl border border-brand-border bg-brand-faint/55 p-4">
                <h3 className="text-sm font-semibold text-brand-ink">
                  Select Registered Equipment
                </h3>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  Use this for a machine already saved under this customer.
                </p>
                <ActionForm
                  action={linkComplaintEquipmentFromForm}
                  className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="complaintId" value={complaintId} />
                  <input type="hidden" name="equipmentMode" value="existing" />
                  <Field label="Registered Equipment" required>
                    <EquipmentSelect
                      name="equipmentId"
                      required
                      options={equipmentOptions}
                    />
                  </Field>
                  <div className="self-end">
                    <Button type="submit">Link Equipment</Button>
                  </div>
                </ActionForm>
              </section>
            )}

            <ExternalEquipmentPanel
              complaintId={complaintId}
              brands={brands}
              mode="link"
              open={equipmentOptions.length === 0}
            />
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      {addedCount > 0 && (
        <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {addedCount} equipment service job{addedCount === 1 ? "" : "s"} added to this visit.
        </AutoDismissNotice>
      )}
      {changeNotices}
      {visitSummary}
      <Card className="mt-6">
        <CardHeader
          title="More Equipment at This Visit"
          subtitle="For gyms or sites with several machines, create one service job per machine so every diagnosis, repair, amount and history stays separate."
        />
        <CardBody className="space-y-4">
          <details className="group rounded-2xl border border-brand-accent/55 bg-brand-faint/45 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-brand-primary [&::-webkit-details-marker]:hidden">
              <span>+ Add Equipment Services</span>
              <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 space-y-5 border-t border-brand-border pt-4">
              <div className="rounded-xl border border-brand-border bg-white p-4">
                <h3 className="text-sm font-semibold text-brand-ink">
                  Registered Equipment
                </h3>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  Select all machines requiring service now. Add a separate problem
                  for each selected machine.
                </p>
                {otherEquipmentOptions.length > 0 ? (
                  <ActionForm
                    action={addComplaintEquipmentServiceFromForm}
                    className="mt-4 space-y-4"
                  >
                    <input
                      type="hidden"
                      name="sourceComplaintId"
                      value={complaintId}
                    />
                    <input type="hidden" name="equipmentMode" value="existing" />
                    <VisitEquipmentSelector options={otherEquipmentOptions} />
                    <Button type="submit">
                      Create Service Jobs for Selected Equipment
                    </Button>
                  </ActionForm>
                ) : (
                  <p className="mt-3 rounded-xl bg-brand-subtle p-3 text-xs text-brand-muted">
                    No other registered equipment is available. Register external
                    equipment below.
                  </p>
                )}
              </div>

              <ExternalEquipmentPanel
                complaintId={complaintId}
                brands={brands}
                mode="additional"
                open={otherEquipmentOptions.length === 0}
              />
            </div>
          </details>

        </CardBody>
      </Card>
    </>
  );
}

function VisitServiceList({
  services,
  currentComplaintId,
  detailBasePath,
  brands,
  canManage,
  canDelete,
}: {
  services: VisitService[];
  currentComplaintId: string;
  detailBasePath: "/complaints" | "/jobs";
  brands: BrandOption[];
  canManage: boolean;
  canDelete: boolean;
}) {
  return (
    <div id="equipment-services" className="scroll-mt-24">
    <Card className="mt-6 overflow-hidden border-brand-accent/55">
      <CardHeader
        title="Equipment Services in This Visit"
        subtitle={`${services.length} machine${services.length === 1 ? "" : "s"} recorded. Open any machine to complete and track its service separately.`}
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Complaint</th>
              <th>Equipment</th>
              <th>Problem Reported</th>
              <th>Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const current = service.id === currentComplaintId;
              const canChangeService =
                canManage &&
                Boolean(service.equipment) &&
                !["SERVICE_COMPLETED", "CLOSED", "CANCELLED"].includes(
                  service.status,
                );
              return (
                <tr key={service.id} className={current ? "bg-brand-faint/65" : undefined}>
                  <td className="font-semibold text-brand-primary">
                    {service.complaintNumber}
                  </td>
                  <td className="min-w-56 font-medium text-brand-ink">
                    {service.equipment
                      ? equipmentLabel(service.equipment)
                      : "Equipment not linked"}
                  </td>
                  <td className="min-w-64 max-w-xl whitespace-normal">
                    {service.customerComplaint}
                  </td>
                  <td>
                    <Badge value={service.status} />
                  </td>
                  <td className="text-center">
                    <div className="flex min-w-48 flex-wrap items-center justify-center gap-2">
                      {current ? (
                        <span className="inline-flex min-h-9 items-center rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-primary">
                          Current
                        </span>
                      ) : (
                        <Link
                          href={`${detailBasePath}/${service.id}`}
                          className="inline-flex min-h-9 items-center rounded-lg border border-brand-accent bg-white px-3 py-2 text-xs font-semibold text-brand-primary transition hover:bg-brand-faint"
                        >
                          Open Service
                        </Link>
                      )}
                      {canChangeService && service.equipment && (
                        <VisitServiceActions
                          complaintId={service.id}
                          complaintNumber={service.complaintNumber}
                          returnComplaintId={currentComplaintId}
                          customerComplaint={service.customerComplaint}
                          equipment={service.equipment}
                          brands={brands}
                          allowDelete={canDelete}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
    </div>
  );
}

function ExternalEquipmentPanel({
  complaintId,
  brands,
  mode,
  open,
}: {
  complaintId: string;
  brands: BrandOption[];
  mode: "link" | "additional";
  open: boolean;
}) {
  const additional = mode === "additional";
  return (
    <details
      open={open}
      className="group rounded-2xl border border-brand-border bg-white p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-brand-ink [&::-webkit-details-marker]:hidden">
        <span>
          {additional
            ? "Register External Equipment & Create Service Job"
            : "Register & Link External Equipment"}
        </span>
        <span aria-hidden="true" className="text-lg text-brand-primary transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-brand-muted">
        Use this when the machine was not purchased from Vellore Fitness Equipment
        or has never been registered in this software.
        {additional &&
          " After saving, it appears in the visit list above. Repeat this for each external machine."}
      </p>
      <ActionForm
        action={
          additional
            ? addComplaintEquipmentServiceFromForm
            : linkComplaintEquipmentFromForm
        }
        className="mt-4 grid gap-4 border-t border-brand-border pt-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {additional ? (
          <input
            type="hidden"
            name="sourceComplaintId"
            value={complaintId}
          />
        ) : (
          <input type="hidden" name="complaintId" value={complaintId} />
        )}
        <input type="hidden" name="equipmentMode" value="new" />
        <Field label="Equipment Name" required>
          <Input
            name="newEquipmentName"
            required
            placeholder="Example: Treadmill"
          />
        </Field>
        <Field label="Brand">
          <Select name="newEquipmentBrand" defaultValue="">
            <option value="">Select brand</option>
            {brands.map((brand) => (
              <option key={brand.name} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model Number">
          <Input name="newEquipmentModel" />
        </Field>
        <Field label="Serial Number">
          <Input name="newEquipmentSerial" />
        </Field>
        {additional && (
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Problem on This Equipment" required>
              <Textarea
                name="customerComplaint"
                required
                rows={3}
                placeholder="Describe the problem for this machine only."
              />
            </Field>
          </div>
        )}
        <div className="md:col-span-2 xl:col-span-4">
          <Field label="Equipment Notes">
            <Textarea
              name="newEquipmentNotes"
              rows={2}
              placeholder="Optional identification or location details."
            />
          </Field>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <Button type="submit">
            {additional
              ? "Register Equipment & Create Service Job"
              : "Register & Link Equipment"}
          </Button>
        </div>
      </ActionForm>
    </details>
  );
}
