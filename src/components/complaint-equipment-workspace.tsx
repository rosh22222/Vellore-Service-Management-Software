import Link from "next/link";
import {
  addComplaintEquipmentServiceFromForm,
  linkComplaintEquipmentFromForm,
} from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { EquipmentSelect } from "@/components/equipment-select";
import { IdentifyEquipmentBatchForm } from "@/components/identify-equipment-batch-form";
import { VisitServiceActions } from "@/components/visit-service-actions";
import { VisitServiceCompletion } from "@/components/visit-service-completion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { equipmentLabel } from "@/lib/equipment-label";
import { money } from "@/lib/format";

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
  inspection: { actualProblem: string } | null;
  workLogs: Array<{ workDone: string }>;
  assignments: Array<{ id: string }>;
  serviceRecord: {
    id: string;
    serviceNumber: string;
    charges: number | string | { toString(): string };
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
  addedCount = 0,
  equipmentUpdated = false,
  equipmentDeleted = false,
  equipmentCompleted = false,
  visitCompleted = false,
}: {
  complaintId: string;
  equipment: EquipmentOption[];
  brands: BrandOption[];
  currentEquipmentId: string | null;
  canAdd?: boolean;
  canDelete?: boolean;
  visitServices: VisitService[];
  addedCount?: number;
  equipmentUpdated?: boolean;
  equipmentDeleted?: boolean;
  equipmentCompleted?: boolean;
  visitCompleted?: boolean;
}) {
  const equipmentOptions = equipment.map((item) => ({
    value: item.id,
    label: equipmentLabel(item),
  }));
  const visitSummary = (
    <VisitServiceList
      services={visitServices}
      currentComplaintId={complaintId}
      brands={brands}
      canManage={canAdd}
      canDelete={canDelete}
      showExternalEquipmentRegistration={canAdd && Boolean(currentEquipmentId)}
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
      {equipmentCompleted && (
        <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Equipment service completed. Continue with the next pending machine below.
        </AutoDismissNotice>
      )}
      {visitCompleted && (
        <AutoDismissNotice className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          All equipment services in this visit are completed.
        </AutoDismissNotice>
      )}
    </>
  );

  if (!canAdd)
    return (
      <>
        {changeNotices}
        {visitSummary}
      </>
    );

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

            <IdentifyEquipmentBatchForm
              complaintId={complaintId}
              brands={brands}
              initialProblem={
                visitServices.find((service) => service.id === complaintId)
                  ?.customerComplaint ?? ""
              }
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
    </>
  );
}

function VisitServiceList({
  services,
  currentComplaintId,
  brands,
  canManage,
  canDelete,
  showExternalEquipmentRegistration,
}: {
  services: VisitService[];
  currentComplaintId: string;
  brands: BrandOption[];
  canManage: boolean;
  canDelete: boolean;
  showExternalEquipmentRegistration: boolean;
}) {
  const completedCount = services.filter(
    (service) => service.serviceRecord,
  ).length;
  const pendingCount = services.filter(
    (service) =>
      !service.serviceRecord &&
      !["SERVICE_COMPLETED", "CLOSED", "CANCELLED"].includes(service.status),
  ).length;
  const resolvedCount = services.length - pendingCount;
  const progress = services.length
    ? Math.round((resolvedCount / services.length) * 100)
    : 0;
  const visitServiceTotal = services.reduce(
    (total, service) => total + Number(service.serviceRecord?.charges ?? 0),
    0,
  );

  return (
    <div id="equipment-services" className="scroll-mt-24">
      <Card className="mt-6 overflow-hidden border-brand-accent/55">
        <CardHeader title="Service Visit Workspace" />
        <div className="border-b border-brand-border bg-brand-faint/50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-brand-ink">
                {completedCount} of {services.length} equipment services completed
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {pendingCount > 0
                  ? `${pendingCount} machine${pendingCount === 1 ? "" : "s"} remaining`
                  : "All machines in this visit are completed"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-xl border border-brand-accent/50 bg-white px-4 py-2 text-right shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Visit Service Total
                </p>
                <p className="mt-0.5 text-lg font-bold text-brand-primary">
                  {money(visitServiceTotal)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-subtle">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table service-visit-table">
            <thead>
              <tr>
                <th className="text-center">Complaint</th>
                <th className="text-center">Equipment</th>
                <th className="text-center">Problem Reported</th>
                <th className="text-center">Service Amount</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const canChangeService =
                  canManage &&
                  Boolean(service.equipment) &&
                  !["SERVICE_COMPLETED", "CLOSED", "CANCELLED"].includes(
                    service.status,
                  );
                const equipmentName = service.equipment
                  ? equipmentLabel(service.equipment)
                  : "Equipment not linked";
                const equipmentTableName = service.equipment
                  ? [service.equipment.name, service.equipment.modelNumber]
                      .filter(Boolean)
                      .join(" • ")
                  : "Equipment not linked";
                const canCompleteService =
                  canChangeService && service.assignments.length > 0;
                return (
                  <tr key={service.id}>
                    <td className="text-center font-semibold text-brand-primary">
                      {service.complaintNumber}
                    </td>
                    <td className="min-w-56 text-center font-medium text-brand-ink">
                      {equipmentTableName}
                    </td>
                    <td className="min-w-64 max-w-xl whitespace-normal text-center">
                      {service.customerComplaint}
                    </td>
                    <td className="whitespace-nowrap text-center font-semibold text-brand-ink">
                      {service.serviceRecord
                        ? money(service.serviceRecord.charges)
                        : "Pending"}
                    </td>
                    <td className="text-center">
                      <Badge
                        value={service.status}
                        label={service.serviceRecord ? "Completed" : undefined}
                      />
                    </td>
                    <td className="text-center">
                      <div className="flex min-w-64 flex-col items-center justify-center gap-2">
                        <div className="flex justify-center">
                          {service.serviceRecord ? (
                            <Link
                              href={`/service-history/${service.serviceRecord.id}`}
                              className="inline-flex min-h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                            >
                              View Service Record
                            </Link>
                          ) : canCompleteService && service.equipment ? (
                            <VisitServiceCompletion
                              complaintId={service.id}
                              complaintNumber={service.complaintNumber}
                              returnComplaintId={currentComplaintId}
                              equipmentName={equipmentName}
                              customerComplaint={service.customerComplaint}
                              actualProblem={service.inspection?.actualProblem ?? ""}
                              workDone={service.workLogs
                                .map((log) => log.workDone)
                                .join("\n")}
                              pendingCount={pendingCount}
                            />
                          ) : (
                            <span className="text-xs font-medium text-brand-muted">
                              {!service.equipment
                                ? "Equipment required"
                                : canChangeService &&
                                    service.assignments.length === 0
                                  ? "Assign technician first"
                                  : "Service closed"}
                            </span>
                          )}
                        </div>
                        {canChangeService && service.equipment && (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <VisitServiceActions
                              complaintId={service.id}
                              complaintNumber={service.complaintNumber}
                              returnComplaintId={currentComplaintId}
                              customerComplaint={service.customerComplaint}
                              equipment={service.equipment}
                              brands={brands}
                              allowDelete={canDelete}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {showExternalEquipmentRegistration && (
          <div className="border-t border-brand-border bg-brand-faint/35 p-5">
            <ExternalEquipmentPanel
              complaintId={currentComplaintId}
              brands={brands}
              open={false}
            />
          </div>
        )}
      </Card>
      </div>
  );
}

function ExternalEquipmentPanel({
  complaintId,
  brands,
  open,
}: {
  complaintId: string;
  brands: BrandOption[];
  open: boolean;
}) {
  return (
    <details
      open={open}
      className="group"
    >
      <summary className="ml-auto flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-brand-primary bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover [&::-webkit-details-marker]:hidden">
        <span>+ Add Equipment</span>
        <span
          aria-hidden="true"
          className="text-xs transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <div className="mt-4 rounded-2xl border border-brand-border bg-white p-4">
        <p className="text-xs leading-5 text-brand-muted">
          Use this when the machine was not purchased from Vellore Fitness Equipment
          or has never been registered in this software.
          {" After saving, it appears in the visit list above. Repeat this for each external machine."}
        </p>
        <ActionForm
          action={addComplaintEquipmentServiceFromForm}
          className="mt-4 grid gap-4 border-t border-brand-border pt-4 md:grid-cols-2 xl:grid-cols-4"
        >
        <input
          type="hidden"
          name="sourceComplaintId"
          value={complaintId}
        />
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
          <Button type="submit">Add Equipment Service</Button>
        </div>
        </ActionForm>
      </div>
    </details>
  );
}
