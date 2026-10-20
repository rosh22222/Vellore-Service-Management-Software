// Run against a local production server built in .next-validation.
// Only uniquely named QA records are removed in finally; existing data is untouched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { encodeReply, createServerReference } = require("next/dist/compiled/react-server-dom-webpack/client.node");
const base = process.env.QA_BASE_URL || "http://localhost:3100";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local app only");
assert(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname), "Local database only");
const db = new PrismaClient();
const tag = `QA-${Date.now()}-${randomUUID().slice(0, 6)}`;
const pass = randomUUID();
const distDir = process.env.VFE_DIST_DIR || ".next-validation";
const actions = JSON.parse(readFileSync(`${distDir}/server/server-reference-manifest.json`, "utf8")).node;
const actionId = name => {
  const match = Object.entries(actions).find(([, value]) => value.exportedName === name);
  assert(match, `Missing server action: ${name}`);
  return match[0];
};
let checks = 0;
function passed(label) { checks++; console.log(`PASS ${label}`); }
function client() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const response = await fetch(new URL(path, base), {
      ...options, redirect: "manual",
      headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...options.headers },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]; const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return response;
  };
}
async function login(request, username) {
  const csrf = await (await request("/api/auth/csrf")).json();
  const response = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, username, password: pass, json: "true" }),
  });
  assert.equal(response.status, 200, "Credential login");
  const session = await (await request("/api/auth/session")).json();
  assert(session.user?.id, "Session exists");
}
async function act(request, name, values, path, bound = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  const reference = createServerReference(actionId(name));
  const body = await encodeReply([bound.length ? reference.bind(null, ...bound) : reference, data]);
  const response = await request(path, {
    method: "POST", body,
    headers: { "Next-Action": actionId("submitWithFeedback"), Origin: base },
  });
  const text = await response.text();
  return { status: response.status, text, redirect: response.headers.get("x-action-redirect") || response.headers.get("location") };
}
function success(result, label) {
  assert(result.redirect || result.text.includes('"ok":true'), `${label}: status ${result.status}; ${result.text.slice(-350)}`);
  passed(label);
}
function rejected(result, label) {
  assert(result.text.includes('"ok":false'), `${label}: expected inline validation, got ${result.status}`);
  passed(label);
}
async function page(request, path) {
  let response = await request(path);
  for (let count = 0; count < 5 && response.headers.get("location") && [301,302,303,307,308].includes(response.status); count++) response = await request(response.headers.get("location"));
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert(!html.includes('"digest"') && !html.includes("Action could not be completed"), `No server error on ${path}`);
  passed(`Page ${path.replace(/cm[a-z0-9]+/g, "[id]")}`);
  return html;
}
const admin = client(), tech = client(), staff = client(), anonymous = client();
let adminId, staffId, technicianUserId, technicianId;
const product = (serial, prefix = "") => Object.fromEntries(Object.entries({
  itemName: "QA treadmill", brand: "QA brand", modelNumber: "QA-M1", serialNumber: serial,
  quantity: "1", unitPrice: "1200.50", warrantyApplicable: "on", warrantyMonths: "12",
  warrantyStartDate: "2026-01-31", warrantyExpiryDate: "2027-01-31", warrantyDuration: "12 Months",
}).map(([k, v]) => [prefix + k, v]));
try {
  const hash = await bcrypt.hash(pass, 10);
  const owner = await db.user.create({ data: { name: tag, username: `${tag}-admin`.toLowerCase(), passwordHash: hash, role: "ADMIN", canAssignTechnician: true } });
  adminId = owner.id;
  const clerk = await db.user.create({ data: { name: tag, username: `${tag}-staff`.toLowerCase(), passwordHash: hash, role: "OFFICE_STAFF", canAssignTechnician: false } });
  staffId = clerk.id;
  await login(admin, owner.username); await login(staff, clerk.username);
  passed("Admin and office staff authentication");
  assert.equal((await anonymous("/api/reports/export")).status, 401);
  assert.equal((await anonymous("/bill-details")).status, 307);
  passed("Anonymous access blocked");
  rejected(await act(admin, "createTechnician", { name: tag, mobile: "9000000000", username: `${tag}-tech`, password: pass }, "/technicians/new"), "Technician email is required");
  const technicianEmail = `${tag.toLowerCase()}@example.test`;
  success(await act(admin, "createTechnician", { name: tag, email: technicianEmail, mobile: "9000000000", username: `${tag}-tech`, password: pass, specialization: "QA testing" }, "/technicians/new"), "Create technician and login account");
  const technician = await db.technician.findFirstOrThrow({ where: { name: tag }, include: { user: true } });
  technicianId = technician.id; technicianUserId = technician.user.id;
  await login(tech, technician.user.username);
  await login(tech, technicianEmail);
  passed("Technician authentication");
  success(await act(admin, "updateTechnician", { name: tag, email: technicianEmail, mobile: "9000000001", username: technician.user.username, specialization: "Updated QA specialization" }, `/technicians/${technicianId}/edit`, [technicianId]), "Edit technician profile");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: technicianUserId } })).specialization, "Updated QA specialization");
  passed("Technician profile stays synchronized with login account");
  const values = {
    billNumber: tag, billDate: "2026-10-04", customerMode: "new", newCustomerType: "GYM",
    newCustomerName: tag, newCustomerPrimaryMobile: "9000000000", newCustomerAddress: "QA address",
    newCustomerCity: "Vellore", newCustomerState: "Tamil Nadu", newCustomerPinCode: "632001",
    productCount: 2, ...product(`${tag}-1`, "items.0."), ...product(`${tag}-2`, "items.1."),
  };
  rejected(await act(admin, "createBillDetail", { ...values, newCustomerPinCode: "" }, "/bill-details/new"), "Required PIN validation returns readable error");
  assert.equal(await db.billDetail.count({ where: { billNumber: tag } }), 0);
  success(await act(admin, "createBillDetail", values, "/bill-details/new"), "Create bill with new customer and two products");
  let bill = await db.billDetail.findUniqueOrThrow({ where: { billNumber: tag }, include: { items: true } });
  assert.equal(Number(bill.total), 2401); assert.equal(bill.items.length, 2);
  passed("Bill total and product links correct");
  rejected(await act(admin, "createBillDetail", values, "/bill-details/new"), "Duplicate invoice rejected without duplicate customer");
  success(await act(admin, "addBillDetailItemFromForm", { billDetailId: bill.id, ...product(`${tag}-3`) }, `/bill-details/${bill.id}/add-product`), "Add product to saved bill");
  const item = bill.items[0];
  success(await act(admin, "updateBillDetailItem", { ...product(`${tag}-1`), itemName: "QA edited product", unitPrice: "1400" }, `/bill-details/${bill.id}/items/${item.id}/edit`, [item.id]), "Edit saved product");
  let equipment = await db.customerEquipment.findUniqueOrThrow({ where: { id: item.equipmentId } });
  assert.equal(equipment.name, "QA edited product");
  passed("Product changes sync to equipment");
  success(await act(admin, "updateEquipment", { name: "QA synced equipment", brand: "QA brand", serialNumber: `${tag}-1`, invoiceNumber: tag, status: "ACTIVE", warrantyStartDate: "2026-01-31", warrantyExpiryDate: "2027-01-31" }, `/equipment/${equipment.id}/edit`, [equipment.id]), "Edit equipment");
  assert.equal((await db.billDetailItem.findUniqueOrThrow({ where: { id: item.id } })).itemName, "QA synced equipment");
  passed("Equipment changes sync back to bill");
  success(await act(admin, "updateBillDetail", { billNumber: `${tag}-edited`, billDate: "2026-10-04", customerId: bill.customerId }, `/bill-details/${bill.id}/edit`, [bill.id]), "Edit invoice number after saving");
  assert.equal((await db.customerEquipment.findUniqueOrThrow({ where: { id: equipment.id } })).invoiceNumber, `${tag}-edited`);
  passed("Invoice number syncs to linked equipment");
  const disposableBill = { billNumber: `${tag}-delete`, billDate: "2026-10-04", customerMode: "existing", customerId: bill.customerId, productCount: 1, ...product(`${tag}-delete`, "items.0.") };
  success(await act(admin, "createBillDetail", disposableBill, "/bill-details/new"), "Create bill for existing customer");
  const disposable = await db.billDetail.findUniqueOrThrow({ where: { billNumber: disposableBill.billNumber }, include: { items: true } });
  success(await act(admin, "deleteBillDetailFromForm", { billDetailId: disposable.id }, "/bill-details"), "Delete unused bill");
  assert.equal(await db.customerEquipment.count({ where: { id: disposable.items[0].equipmentId } }), 0);
  assert(await db.customer.findUnique({ where: { id: bill.customerId } }));
  passed("Safe deletion removes unused equipment and preserves shared customer");
  const invoiceRows = await db.billDetail.findMany({ select: { billNumber: true } });
  const nextInvoice = Math.max(0, ...invoiceRows.map(b => /^VFE-INV-\d+$/.test(b.billNumber) ? Number(b.billNumber.slice(8)) : 0)) + 1;
  const suggestion = `VFE-INV-${String(nextInvoice).padStart(4, "0")}`;
  const concurrentBills = await Promise.all([1, 2].map(i => act(admin, "createBillDetail", { ...disposableBill, billNumber: suggestion, suggestedBillNumber: suggestion, ...product(`${tag}-concurrent-${i}`, "items.0.") }, "/bill-details/new")));
  concurrentBills.forEach((r, i) => success(r, `Concurrent automatic invoice ${i + 1}`));
  const bulkFields = (quantity, prefix = "") => ({ ...product(`${tag}-machine-1`, prefix), [prefix + "quantity"]: quantity,
    ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [prefix + `unitSerialNumbers.${i + 1}`, `${tag}-machine-${i + 2}`])) });
  const bulkValues = { ...disposableBill, billNumber: `${tag}-five-machines`, ...bulkFields(5, "items.0.") };
  rejected(await act(admin, "createBillDetail", { ...bulkValues, "items.0.quantity": 2.5 }, "/bill-details/new"), "Fractional machine quantity rejected clearly");
  rejected(await act(admin, "createBillDetail", { ...bulkValues, "items.0.unitSerialNumbers.1": `${tag}-machine-1` }, "/bill-details/new"), "Duplicate machine serials rejected before saving");
  success(await act(admin, "createBillDetail", bulkValues, "/bill-details/new"), "Save one product line containing five treadmills");
  const bulkBill = await db.billDetail.findUniqueOrThrow({ where: { billNumber: bulkValues.billNumber }, include: { items: { include: { units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } } } });
  const bulkItem = bulkBill.items[0], machineIds = bulkItem.units.map(unit => unit.equipmentId);
  assert.equal(bulkBill.items.length, 1); assert.equal(Number(bulkItem.quantity), 5); assert.equal(machineIds.length, 5); assert.equal(Number(bulkBill.total), 6002.5);
  passed("Five purchased machines have separate IDs, serials and warranty records without duplicating the bill line");
  success(await act(admin, "updateBillDetailItem", bulkFields(7), `/bill-details/${bulkBill.id}/items/${bulkItem.id}/edit`, [bulkItem.id]), "Increase saved quantity from five to seven");
  success(await act(admin, "updateBillDetailItem", bulkFields(5), `/bill-details/${bulkBill.id}/items/${bulkItem.id}/edit`, [bulkItem.id]), "Reduce unused quantity from seven back to five");
  assert.equal(Number((await db.billDetail.findUniqueOrThrow({ where: { id: bulkBill.id } })).total), 6002.5);
  assert.deepEqual((await db.billDetailItemUnit.findMany({ where: { billDetailItemId: bulkItem.id }, orderBy: { unitNumber: "asc" } })).map(unit => unit.equipmentId), machineIds);
  passed("Quantity edits recalculate totals and preserve the five original machines");
  success(await act(admin, "createComplaintFromBillDetailFromForm", { billDetailId: bulkBill.id, equipmentId: machineIds[1], customerComplaint: "Motor stops after running", technicianId }, `/bill-details/${bulkBill.id}`), "Create and assign complaint for treadmill number two");
  const machineTwoComplaint = await db.serviceComplaint.findFirstOrThrow({ where: { equipmentId: machineIds[1] } });
  const machineTwoJob = `/jobs/${machineTwoComplaint.id}`;
  success(await act(tech, "saveInspectionFromForm", { complaintId: machineTwoComplaint.id, findings: "Motor stops after running", actualProblem: "Motor stops after running" }, machineTwoJob), "Inspect only treadmill number two");
  success(await act(tech, "addWorkLogFromForm", { complaintId: machineTwoComplaint.id, workDone: "Repaired treadmill two motor and tested" }, machineTwoJob), "Record machine-specific repair work");
  success(await act(tech, "completeServiceFromForm", { complaintId: machineTwoComplaint.id, completionNotes: "Machine two tested", charges: 200 }, machineTwoJob), "Complete treadmill number two independently");
  success(await act(admin, "createComplaintFromBillDetailFromForm", { billDetailId: bulkBill.id, equipmentId: machineIds[4], customerComplaint: "Motor stops after running" }, `/bill-details/${bulkBill.id}`), "Register a later problem on treadmill number five");
  const machineFiveComplaint = await db.serviceComplaint.findFirstOrThrow({ where: { equipmentId: machineIds[4] } });
  assert.equal(machineFiveComplaint.repeatIssueDetected, false);
  assert.equal(await db.serviceRecord.count({ where: { equipmentId: machineIds[4] } }), 0);
  assert.equal(await db.serviceRecord.count({ where: { equipmentId: machineIds[1] } }), 1);
  assert.equal(await db.serviceComplaint.count({ where: { equipmentId: machineIds[0] } }), 0);
  passed("Machine-five history does not inherit machine-two service or repeat-issue flags");
  success(await act(admin, "createComplaintFromBillDetailFromForm", { billDetailId: bulkBill.id, equipmentId: machineIds[1], customerComplaint: "Motor stops after running" }, `/bill-details/${bulkBill.id}`), "Register a genuine repeat on treadmill number two");
  assert.equal((await db.serviceComplaint.findFirstOrThrow({ where: { equipmentId: machineIds[1], id: { not: machineTwoComplaint.id } } })).repeatIssueDetected, true);
  passed("Repeat detection remains scoped to the affected physical machine");
  rejected(await act(admin, "updateBillDetailItem", bulkFields(4), `/bill-details/${bulkBill.id}/items/${bulkItem.id}/edit`, [bulkItem.id]), "Quantity reduction cannot remove machine five's complaint history");
  const bulkDelete = await act(admin, "deleteBillDetailFromForm", { billDetailId: bulkBill.id }, "/bill-details");
  assert(bulkDelete.redirect?.includes("deleteBlocked=1")); assert.equal(await db.billDetailItemUnit.count({ where: { billDetailItemId: bulkItem.id } }), 5);
  passed("Bill deletion checks every unit, not just the first machine");
  const bulkHtml = await page(admin, `/bill-details/${bulkBill.id}`);
  for (const unit of bulkItem.units) assert(bulkHtml.includes(unit.equipment.equipmentCode));
  await page(admin, `/equipment/${machineIds[4]}`);
  await page(admin, `/bill-details/${bulkBill.id}/items/${bulkItem.id}/edit`);
  const machineSearch = await page(admin, `/bill-details?q=${encodeURIComponent(bulkItem.units[4].equipment.serialNumber)}`);
  assert(machineSearch.includes(bulkBill.billNumber)); passed("Bill search finds a non-first machine by its serial number");
  rejected(await act(staff, "createComplaintFromBillDetailFromForm", { billDetailId: bill.id, equipmentId: equipment.id, customerComplaint: "Motor belt slipping", technicianId }, `/bill-details/${bill.id}`), "Staff assignment permission enforced");
  success(await act(admin, "createComplaintFromBillDetailFromForm", { billDetailId: bill.id, equipmentId: equipment.id, customerComplaint: "Motor belt slipping", technicianId, preferredVisitDate: "2026-10-05" }, `/bill-details/${bill.id}`), "Complaint from one bill product with technician and visit date");
  let complaint = await db.serviceComplaint.findFirstOrThrow({ where: { equipmentId: equipment.id } });
  const job = `/jobs/${complaint.id}`;
  rejected(await act(tech, "completeServiceFromForm", { complaintId: complaint.id, completionNotes: "Finished", charges: 500 }, job), "Completion requires diagnosis and work");
  success(await act(tech, "saveInspectionFromForm", { complaintId: complaint.id, findings: "Belt is loose", actualProblem: "Motor belt slipping" }, job), "Technician saves diagnosis");
  success(await act(tech, "addWorkLogFromForm", { complaintId: complaint.id, workDone: "Adjusted belt tension and tested treadmill" }, job), "Technician records work done");
  success(await act(tech, "completeServiceFromForm", { complaintId: complaint.id, completionNotes: "Tested and handed over", charges: 500, collectedNow: 100, paymentMode: "CASH" }, job), "Complete service and collect initial payment");
  const service = await db.serviceRecord.findUniqueOrThrow({ where: { complaintId: complaint.id }, include: { collections: true } });
  assert.equal(service.collections.length, 1); assert.equal(Number(service.charges), 500);
  assert.equal(await db.serviceAssignment.count({ where: { complaintId: complaint.id, isActive: true } }), 0);
  passed("Permanent service history, charges, payment and assignment closure");
  rejected(await act(tech, "addWorkLogFromForm", { complaintId: complaint.id, workDone: "must not overwrite" }, job), "Completed service is immutable");
  const payments = await Promise.all([1, 2].map(() => act(admin, "createServiceCollection", { serviceRecordId: service.id, amount: 300, paymentMode: "UPI" }, "/service-collections")));
  assert.equal(payments.filter(r => r.text.includes('"ok":true')).length, 1);
  assert.equal(payments.filter(r => r.text.includes('"ok":false')).length, 1);
  passed("Simultaneous payments cannot exceed balance");
  success(await act(admin, "createServiceCollection", { serviceRecordId: service.id, amount: 100, paymentMode: "CASH" }, "/service-collections"), "Collect remaining balance");
  const total = await db.serviceCollection.aggregate({ where: { serviceRecordId: service.id }, _sum: { amount: true } });
  assert.equal(Number(total._sum.amount), 500); passed("Payments equal service charge");
  const deletion = await act(admin, "deleteBillDetailFromForm", { billDetailId: bill.id }, "/bill-details");
  assert(deletion.redirect?.includes("deleteBlocked=1")); assert(await db.billDetail.findUnique({ where: { id: bill.id } }));
  passed("Bill deletion protects existing service history");
  const before = service.workDone;
  success(await act(admin, "createComplaintFromBillDetailFromForm", { billDetailId: bill.id, equipmentId: equipment.id, customerComplaint: "Motor belt slipping", technicianId }, `/bill-details/${bill.id}`), "Register repeat complaint for same product");
  const repeat = await db.serviceComplaint.findFirstOrThrow({ where: { equipmentId: equipment.id, id: { not: complaint.id } } });
  assert(repeat.repeatIssueDetected); assert.equal((await db.serviceRecord.findUniqueOrThrow({ where: { id: service.id } })).workDone, before);
  passed("Repeat issue detected and previous service preserved");
  success(await act(admin, "updateServiceStatusFromForm", { complaintId: repeat.id, status: "CANCELLED", notes: "QA cancel" }, `/complaints/${repeat.id}`), "Cancel open complaint");
  rejected(await act(tech, "saveInspectionFromForm", { complaintId: repeat.id, findings: "No", actualProblem: "No" }, `/jobs/${repeat.id}`), "Cancelled complaint cannot be reopened through diagnosis");
  success(await act(admin, "createComplaint", {
    customerMode: "new", equipmentMode: "unknown", newCustomerType: "HOME_CUSTOMER",
    newCustomerName: tag, newCustomerPrimaryMobile: "9000000000", newCustomerAddress: "External customer address",
    newCustomerCity: "Vellore", newCustomerState: "Tamil Nadu", newCustomerPinCode: "632001",
    technicianId, notes: "QA office notes",
    customerComplaint: "Customer purchased elsewhere; needs a repair", priority: "NORMAL", source: "PHONE",
  }, "/complaints/new"), "Create complaint for a new customer without a purchase bill");
  const externalComplaint = await db.serviceComplaint.findFirstOrThrow({ where: { customerComplaint: "Customer purchased elsewhere; needs a repair", customer: { name: tag } } });
  assert.equal(externalComplaint.currentTechnicianId, technicianId); assert.equal(externalComplaint.status, "TECHNICIAN_ASSIGNED"); assert.equal(externalComplaint.notes, "QA office notes");
  assert.equal(await db.serviceAssignment.count({ where: { complaintId: externalComplaint.id, technicianId } }), 1);
  passed("Standalone complaint atomically assigns its technician and preserves office notes without creating equipment");
  for (const route of ["/dashboard", "/customers", "/customers/new", `/customers/${bill.customerId}`, `/customers/${bill.customerId}/edit`, "/bill-details", "/bill-details/new", `/bill-details/${bill.id}`, `/bill-details/${bill.id}/edit`, `/bill-details/${bill.id}/add-product`, `/bill-details/${bill.id}/items/${item.id}/edit`, "/equipment", "/equipment/new", `/equipment/${equipment.id}`, `/equipment/${equipment.id}/edit`, "/complaints", "/complaints/new", `/complaints/${complaint.id}`, "/assignments", "/technicians", "/technicians/new", `/technicians/${technicianId}`, `/technicians/${technicianId}/edit`, "/service-history", `/service-history/${service.id}`, "/service-collections", "/reports", "/reports?period=custom&from=bad-date", "/settings"]) await page(admin, route);
  await page(tech, "/jobs"); await page(tech, job);
  assert.equal((await tech("/api/reports/export")).status, 403); passed("Technician report export denied");
  const restricted = await tech("/dashboard");
  const restrictedBody = await restricted.text();
  assert(restricted.headers.get("location")?.includes("/jobs") || restrictedBody.includes("/jobs?error=forbidden")); passed("Unauthorized technician redirected without a loop");
  for (const route of [`/api/service-reports/${service.id}`, "/api/reports/export?format=pdf"]) {
    const response = await admin(route); assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    passed(`PDF response ${route.startsWith('/api/service-reports') ? 'service report' : 'summary report'}`);
  }
  assert.equal((await admin("/api/reports/export?format=csv")).status, 200); passed("CSV export");
  assert.equal((await admin("/api/reports/export?from=bad-date")).status, 400); passed("Invalid export date returns 400");
  await db.user.update({ where: { id: technicianUserId }, data: { isActive: false } });
  const disabledResponse = await tech("/jobs");
  assert(disabledResponse.headers.get("location")?.includes("/login") || (await disabledResponse.text()).includes('url=/login'));
  passed("Disabled account loses existing session access");
  console.log(`RESULT: ${checks} checks passed`);
} finally {
  const customers = await db.customer.findMany({ where: { name: tag }, select: { id: true } });
  const customerIds = customers.map(c => c.id);
  await db.$transaction(async tx => {
    const scope = { customerId: { in: customerIds } };
    await tx.serviceCollection.deleteMany({ where: scope });
    await tx.serviceRecord.deleteMany({ where: scope });
    await tx.serviceComplaint.deleteMany({ where: scope });
    await tx.billDetail.deleteMany({ where: scope });
    await tx.customerEquipment.deleteMany({ where: scope });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    await tx.technician.deleteMany({ where: { name: tag } });
    await tx.user.deleteMany({ where: { OR: [{ name: tag }, { id: { in: [adminId, staffId, technicianUserId].filter(Boolean) } }] } });
  });
  console.log("Cleanup: temporary QA records removed; original client records preserved.");
  await db.$disconnect();
}
