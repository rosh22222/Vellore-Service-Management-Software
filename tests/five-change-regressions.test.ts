import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("brand actions publish specific feedback in the shared three-second notice", () => {
  const brands = source("src/app/(dashboard)/brands/page.tsx");
  const notice = source("src/components/action-feedback-notice.tsx");
  for (const message of [
    "Brand Added",
    "Brand Deleted",
    "Brand Activated",
    "Brand Deactivated",
  ]) {
    assert.match(brands, new RegExp(message));
  }
  assert.match(brands, /feedbackChannel="brands"/);
  assert.match(brands, /ActionFeedbackNotice channel="brands"/);
  assert.match(notice, /duration = 3000/);
});

test("office and technician complaint pages use one simplified completion form", () => {
  for (const path of [
    "src/app/(dashboard)/complaints/[id]/page.tsx",
    "src/app/(dashboard)/jobs/[id]/page.tsx",
  ]) {
    const page = source(path);
    assert.match(page, /label="Actual Problem Found" required/);
    assert.match(page, /name="actualProblem"\s+required/);
    assert.match(page, /label="Work Performed" required/);
    assert.match(page, /name="workDone"\s+required/);
    for (const removed of [
      "Inspection / Actual Problem",
      "Completion Notes",
      "Collected Now",
      "Update Status",
    ]) {
      assert.equal(page.includes(removed), false, `${removed} must not appear in ${path}`);
    }
  }

  const actions = source("src/actions/complaint.ts");
  const completion = actions.slice(
    actions.indexOf("export async function completeService("),
    actions.indexOf("function complaintIdFrom("),
  );
  assert.match(completion, /requiredText\(\s*formData\.get\("actualProblem"\)/);
  assert.match(completion, /requiredText\(\s*formData\.get\("workDone"\)/);
  assert.equal(completion.includes("collectedNow"), false);
  assert.equal(completion.includes('formData.get("completionNotes")'), false);
  assert.equal(completion.includes("serviceCollection.create"), false);
});

test("technician photos are optional and support URL or direct file preview", () => {
  const schema = source("prisma/schema.prisma");
  const field = source("src/components/technician-photo-field.tsx");
  const actions = source("src/actions/technician.ts");
  assert.match(schema, /photoUrl\s+String\?/);
  assert.match(field, /type="url"/);
  assert.match(field, /type="file"/);
  assert.match(field, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(field, /Technician preview/);
  assert.doesNotMatch(field, /name="photoUrl"[^>]*required/);
  assert.match(actions, /photoUrl/);
});

test("a complaint supports multiple active technicians and explicit removal", () => {
  const actions = source("src/actions/complaint.ts");
  const complaintPage = source("src/app/(dashboard)/complaints/[id]/page.tsx");
  assert.match(actions, /export async function unassignTechnicianFromForm/);
  assert.match(actions, /At least one active technician must be assigned before completion/);
  assert.match(actions, /technicianNames\.join\(" & "\)/);
  assert.match(actions, /serviceAssignment\.updateMany\(\{\s*where: \{ complaintId, isActive: true \}/);
  assert.match(complaintPage, /Add Technician/);
  assert.match(complaintPage, /unassignTechnicianFromForm/);
  assert.match(complaintPage, /Technician Assignment/);
  assert.match(complaintPage, /Assigned By/);
});

test("new bill address presents State before dependent City and lazy-loads cities", () => {
  const selects = source("src/components/state-city-selects.tsx");
  const billForm = source("src/components/bill-detail-form.tsx");
  assert(selects.indexOf('label="State"') < selects.indexOf('label="City"'));
  assert.match(selects, /import\("countrycitystatejson\/client"\)/);
  assert.match(selects, /getCities\("IN", state\)/);
  assert.match(selects, /disabled=\{!selectedState \|\| loadingCities\}/);
  assert.match(billForm, /<StateCitySelects/);
  assert.match(billForm, /defaultState=\{editing\?\.customer\.state \?\? ""\}/);
  assert.match(selects, /defaultState = ""/);
  assert.match(selects, /<option value="">Select state<\/option>/);
});
