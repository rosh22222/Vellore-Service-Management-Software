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
  for (const path of [
    "src/app/(dashboard)/complaints/[id]/page.tsx",
    "src/app/(dashboard)/jobs/[id]/page.tsx",
  ]) {
    const page = source(path);
    assert.match(page, /label="Customer Complaint \/ Problem Reported"/);
    assert.match(page, /value=\{c\.customerComplaint\}/);
    assert.match(page, /readOnly/);
  }
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
  for (const path of [
    "src/app/(dashboard)/complaints/[id]/page.tsx",
    "src/app/(dashboard)/jobs/[id]/page.tsx",
  ]) {
    const page = source(path);
    const serviceAmount = page.slice(page.indexOf('label="Service Amount"'));
    assert.match(serviceAmount, /name="charges"/);
    assert.match(serviceAmount, /type="text"/);
    assert.match(serviceAmount, /inputMode="decimal"/);
    assert.doesNotMatch(serviceAmount.slice(0, 700), /type="number"/);
  }
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

test("credited technicians can open a completed job through service history", () => {
  const job = source("src/app/(dashboard)/jobs/[id]/page.tsx");

  assert.match(job, /assignment\.endedReason === "Service completed"/);
  assert.match(job, /redirect\(`\/service-history\/\$\{c\.serviceRecord\.id\}`\)/);
  assert.match(job, /if \(!hasActiveAssignment\) notFound\(\)/);
  assert.doesNotMatch(job, /throw new Error\("This job is not assigned to you\."\)/);
});
