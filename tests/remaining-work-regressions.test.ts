import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("blocked bill actions use the light dismissible dialog and return edit to the register", () => {
  const dialog = source("src/components/dismissible-error-dialog.tsx");
  const editor = source("src/components/bill-edit-panel.tsx");
  const register = source("src/app/(dashboard)/bill-details/page.tsx");
  assert.match(dialog, /bg-white\/90/);
  assert.doesNotMatch(dialog, /bg-slate-950/);
  assert.match(editor, /redirect\("\/bill-details\?editBlocked=1"\)/);
  assert.match(register, /Bill cannot be edited/);
});

test("complaint list no longer exposes or preserves the status filter", () => {
  const page = source("src/app/(dashboard)/complaints/page.tsx");
  assert.doesNotMatch(page, /name="status"/);
  assert.doesNotMatch(page, /params\.status/);
  assert.match(page, /entry\[0\] !== "status"/);
});

test("new complaint supports customer lookup, multiple equipment and multiple technicians", () => {
  const form = source("src/components/complaint-form.tsx");
  const action = source("src/actions/complaint.ts");
  const lookup = source("src/lib/cached-lookups.ts");

  assert.match(form, /Search by customer name, 10-digit phone number or invoice number/);
  assert.match(form, /invoiceNumbers/);
  assert.match(form, /name="equipmentIds"/);
  assert.match(form, /multiple/);
  assert.match(form, /name="technicianIds"/);
  assert.match(action, /formData\.getAll\("equipmentIds"\)/);
  assert.match(action, /formData\.getAll\("technicianIds"\)/);
  assert.match(action, /nextDocumentNumbers/);
  assert.match(action, /serviceAssignment\.createMany/);
  assert.match(lookup, /billDetails: \{/);
  assert.match(form, /<StateCitySelects/);
  assert.match(form, /stateName="newCustomerState"/);
  assert.match(form, /defaultState=""/);
  assert.doesNotMatch(form, /Search equipment name, model or serial number/);
  assert.doesNotMatch(form, /selected — each machine receives its own complaint number/);
});

test("customer notes are removed without affecting complaint office notes", () => {
  for (const path of [
    "src/components/complaint-form.tsx",
    "src/components/bill-detail-form.tsx",
    "src/app/(dashboard)/customers/new/page.tsx",
    "src/app/(dashboard)/customers/[id]/edit/page.tsx",
    "src/app/(dashboard)/customers/[id]/page.tsx",
    "src/actions/complaint.ts",
    "src/actions/bill-detail.ts",
    "src/actions/customer.ts",
  ]) {
    const file = source(path);
    assert.doesNotMatch(file, /newCustomerNotes/);
    assert.doesNotMatch(file, /Customer Notes/);
  }

  const schema = source("prisma/schema.prisma");
  const customerModel = schema.slice(
    schema.indexOf("model Customer {"),
    schema.indexOf("model CustomerEquipment {"),
  );
  assert.doesNotMatch(customerModel, /\bnotes\s+String/);

  const complaintForm = source("src/components/complaint-form.tsx");
  assert.match(complaintForm, /label="Office Notes"/);
  assert.match(complaintForm, /name="notes"/);
});

test("bill details uses the unified complaint form instead of a second limited form", () => {
  const billPage = source("src/app/(dashboard)/bill-details/[id]/page.tsx");
  const complaintForm = source("src/components/complaint-form.tsx");
  assert.doesNotMatch(billPage, /action=\{createComplaintFromBillDetailFromForm\}/);
  assert.match(billPage, /href=\{`\/complaints\/new\?customerId=\$\{bill\.customerId\}`\}/);
  assert.doesNotMatch(billPage, /Raise a service complaint for this bill/);
  assert.match(complaintForm, /initialCustomerId &&/);
  assert.match(complaintForm, /\? "existing"\s*: "unknown"/);
});

test("completion forms show the original customer complaint and Settings omits Website", () => {
  const completion = source("src/components/visit-service-completion.tsx");
  assert.match(completion, /label="Customer Complaint \/ Problem Reported"/);
  assert.match(completion, /value=\{customerComplaint\}/);
  assert.match(completion, /readOnly/);
  const settings = source("src/app/(dashboard)/settings/page.tsx");
  const action = source("src/actions/settings.ts");
  assert.doesNotMatch(settings, /label="Website"/);
  assert.doesNotMatch(action, /formData\.get\("website"\)/);
});

test("multiple technician assignments render as one combined row", () => {
  const complaint = source("src/app/(dashboard)/complaints/[id]/page.tsx");
  const history = source("src/app/(dashboard)/service-history/[id]/page.tsx");
  const action = source("src/actions/complaint.ts");
  for (const page of [complaint, history]) {
    assert.match(page, /summarizeAssignments/);
    assert.match(page, /technicians: join\(.*" & "\)/);
  }
  assert.doesNotMatch(complaint, /\? "Primary"\s*: "Assigned"/);
  assert.match(complaint, /Remove \{assignment\.technician\.name\}/);
  assert.match(action, /technicianNames\.join\(" & "\)/);
});

test("service amounts are typed decimal text and cannot change by spinner or wheel", () => {
  const completion = source("src/components/visit-service-completion.tsx");
  const serviceAmount = completion.slice(
    completion.indexOf('label="Service Amount"'),
  );
  assert.match(serviceAmount, /name="charges"/);
  assert.match(serviceAmount, /type="text"/);
  assert.match(serviceAmount, /inputMode="decimal"/);
  assert.doesNotMatch(serviceAmount.slice(0, 700), /type="number"/);
});

test("charts use unique keys when labels repeat", () => {
  const charts = source("src/components/ui/charts.tsx");
  const reports = source("src/app/(dashboard)/reports/page.tsx");
  assert.match(charts, /function chartKey/);
  assert.match(charts, /key=\{chartKey\(item, index\)\}/);
  assert.doesNotMatch(charts, /key=\{item\.label\}/);
  assert.match(reports, /e\."id" AS "id"/);
  assert.match(reports, /e\."equipmentCode"/);
  assert.match(reports, /id: technician\.id/);
});

test("every technician assigned through completion receives service credit", () => {
  const complaintAction = source("src/actions/complaint.ts");
  const reports = source("src/app/(dashboard)/reports/page.tsx");
  const teams = source("src/app/(dashboard)/teams/page.tsx");
  const technicianProfile = source(
    "src/app/(dashboard)/technicians/[id]/page.tsx",
  );

  assert.match(complaintAction, /technicianNameSnapshot: technicianNames\.join\(" & "\)/);
  assert.match(complaintAction, /endedReason: "Service completed"/);

  for (const page of [reports, teams]) {
    assert.match(page, /a\."complaintId" = s\."complaintId"/);
    assert.match(page, /a\."technicianId" = t\."id"/);
    assert.match(page, /a\."endedReason" = 'Service completed'/);
  }

  assert.match(technicianProfile, /endedReason: "Service completed"/);
});

test("completed complaint shows every technician credited for the service", () => {
  const complaint = source("src/app/(dashboard)/complaints/[id]/page.tsx");

  assert.match(complaint, /technicianNameSnapshot\?\.trim\(\)/);
  assert.match(complaint, /assignment\.endedReason === "Service completed"/);
  assert.match(complaint, /Technician\(s\) Who Worked on This Service/);
  assert.match(complaint, /Service Completed On/);
  assert.match(complaint, /Permanent Service Record/);
});

test("complaint equipment registration uses the active brand master dropdown", () => {
  const complaint = source("src/app/(dashboard)/complaints/[id]/page.tsx");
  const workspace = source(
    "src/components/complaint-equipment-workspace.tsx",
  );

  assert.match(complaint, /getCachedActiveBrands/);
  assert.match(workspace, /<Select name="newEquipmentBrand"/);
  assert.match(workspace, /brands\.map\(\(brand\)/);
  assert.doesNotMatch(workspace, /<Input name="newEquipmentBrand"/);
});

test("office and assigned technicians can identify and service several machines separately", () => {
  const action = source("src/actions/complaint.ts");
  const schema = source("prisma/schema.prisma");
  const workspace = source(
    "src/components/complaint-equipment-workspace.tsx",
  );
  const identifyBatch = source(
    "src/components/identify-equipment-batch-form.tsx",
  );
  const equipmentEntries = source(
    "src/components/visit-equipment-entry-list.tsx",
  );
  const complaint = source("src/app/(dashboard)/complaints/[id]/page.tsx");
  const job = source("src/app/(dashboard)/jobs/[id]/page.tsx");
  const newComplaint = source("src/components/complaint-form.tsx");

  assert.match(action, /export async function addComplaintEquipmentServiceFromForm/);
  assert.match(action, /export async function registerAndLinkVisitEquipmentFromForm/);
  assert.match(action, /\.getAll\("equipmentRows"\)/);
  assert.match(action, /equipmentName\.\$\{rowId\}/);
  assert.match(action, /equipmentProblem\.\$\{rowId\}/);
  assert.match(action, /createdEquipment\[0\]\.id/);
  assert.match(action, /entries\.length - 1/);
  assert.match(action, /Equipment registered during the same visit as/);
  assert.match(action, /requireComplaintAccess\(sourceComplaintId\)/);
  assert.match(action, /Additional equipment added from/);
  assert.match(action, /serviceAssignment\.createMany/);
  assert.match(action, /Added during the same visit as/);
  assert.match(action, /formData\.getAll\("equipmentIds"\)/);
  assert.match(action, /Service requested for/);
  assert.match(action, /serviceVisitGroupId/);
  assert.match(action, /equipmentAdded=\$\{result\.complaints\.length\}/);
  assert.match(action, /Identify or register the equipment before completing service/);
  assert.match(schema, /serviceVisitGroupId\s+String\?/);
  assert.match(workspace, /IdentifyEquipmentBatchForm/);
  assert.doesNotMatch(workspace, /Add More Equipment to This Visit/);
  assert.doesNotMatch(workspace, /Choose Registered Equipment/);
  assert.match(workspace, /Service Visit Workspace/);
  assert.match(workspace, /VisitServiceCompletion/);
  assert.doesNotMatch(workspace, />\s*Current\s*</);
  assert.doesNotMatch(workspace, /VisitEquipmentSelector/);
  assert.match(workspace, /showExternalEquipmentRegistration/);
  assert.match(workspace, /Register External Equipment &amp; Create Service Job/);
  assert.match(workspace, /Add Service Details for each machine/);
  assert.match(workspace, /Problem on This Equipment/);
  assert.match(identifyBatch, /VisitEquipmentEntryList/);
  assert.match(identifyBatch, /Register &amp; Link Equipment/);
  assert.match(equipmentEntries, /name="equipmentRows"/);
  assert.match(equipmentEntries, /\+ Add Another Equipment/);
  assert.match(equipmentEntries, /Problem Reported for This Equipment/);
  assert.match(equipmentEntries, /rows\.length >= MAX_EQUIPMENT_PER_VISIT/);
  assert.match(complaint, /<ComplaintEquipmentWorkspace/);
  assert.match(complaint, /visitServices=\{visitServices\}/);
  assert.match(complaint, /equipmentCompleted=\{query\.equipmentCompleted === "1"\}/);
  assert.match(job, /<ComplaintEquipmentWorkspace/);
  assert.match(job, /visitServices=\{visitServices\}/);
  assert.match(job, /equipmentCompleted=\{query\.equipmentCompleted === "1"\}/);
  assert.match(job, /!complete && \(/);
  assert.match(newComplaint, /Equipment Not Yet Registered/);
  assert.match(newComplaint, /assigned technician can register and link it at the visit/);
  assert.match(newComplaint, /title="\+ Add Equipment"/);
  assert.match(newComplaint, /<VisitEquipmentEntryList/);
  assert.match(newComplaint, /equipmentMode !== "new"/);
  assert.match(action, /equipmentMode === "new" \? parseNewVisitEquipmentEntries/);
  assert.match(action, /equipmentCode: equipmentCodes\[index\]/);
  assert.match(action, /customerComplaint: entry\.customerComplaint/);
});

test("visit equipment is edited and safely deleted from the visit table", () => {
  const action = source("src/actions/complaint.ts");
  const workspace = source(
    "src/components/complaint-equipment-workspace.tsx",
  );
  const rowActions = source("src/components/visit-service-actions.tsx");

  assert.doesNotMatch(workspace, /Correct the equipment linked to this complaint/);
  assert.doesNotMatch(workspace, /correct-equipment/);
  assert.match(workspace, /<VisitServiceActions/);
  assert.match(workspace, /canDelete=\{canDelete\}/);
  assert.match(rowActions, /Edit Equipment Service/);
  assert.match(rowActions, /Save Changes/);
  assert.match(rowActions, /<ConfirmSubmitButton/);
  assert.match(rowActions, /Delete/);
  assert.match(action, /export async function updateVisitEquipmentServiceFromForm/);
  assert.match(action, /export async function deleteVisitEquipmentServiceFromForm/);
  assert.match(action, /Completed or closed equipment services cannot be edited/);
  assert.match(action, /already has work or history/);
  assert.match(action, /Only owner or office staff can delete/);
  assert.match(action, /serviceComplaint\.delete/);
});

test("credited technicians can open a completed job through service history", () => {
  const job = source("src/app/(dashboard)/jobs/[id]/page.tsx");

  assert.match(job, /assignment\.endedReason === "Service completed"/);
  assert.match(job, /redirect\(`\/service-history\/\$\{c\.serviceRecord\.id\}`\)/);
  assert.match(job, /if \(!hasActiveAssignment\) notFound\(\)/);
  assert.doesNotMatch(job, /throw new Error\("This job is not assigned to you\."\)/);
});
