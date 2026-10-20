import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertMachinesUnused, createPurchasedProducts, deleteUnusedBillMachines, updatePurchasedProduct, type BillItemInput } from "../src/lib/bill-equipment";
import { saveBillEditor, type BillEditorInput } from "../src/lib/bill-editor";
import { assertBillEditable, lockEquipmentBills } from "../src/lib/bill-edit";
import { getDashboardSummary } from "../src/lib/dashboard-summary";
import { authenticateCredentials } from "../src/lib/auth-credentials";
import { assertLoginIdentifiers, requiredEmail } from "../src/lib/technician-validation";
import bcrypt from "bcryptjs";

async function main() {
  assert(process.env.BILL_QA_DATABASE_URL, "Set BILL_QA_DATABASE_URL to a local PostgreSQL connection; this test creates and removes its own isolated database.");
  const source = new URL(process.env.BILL_QA_DATABASE_URL || "");
  assert(["127.0.0.1", "localhost"].includes(source.hostname), "Isolated local PostgreSQL only");
  const name = `vfe_machines_qa_${Date.now()}`;
  assert(/^vfe_machines_qa_\d+$/.test(name));
  const adminUrl = new URL(source); adminUrl.pathname = "/postgres";
  const maintenance = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  const url = new URL(source); url.pathname = `/${name}`;
  const db = new PrismaClient({ datasourceUrl: url.toString(), transactionOptions: { timeout: 60000 } });
  const migrationRoot = path.resolve("prisma/migrations");
  const migrations = readdirSync(migrationRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  const latest = "20261015000100_individual_bill_machines";
  const psql = process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" : "psql";
  const apply = (migration: string) => {
    const result = spawnSync(psql, ["-h", url.hostname, "-p", url.port || "5432", "-U", url.username, "-d", name, "-v", "ON_ERROR_STOP=1", "-f", path.join(migrationRoot, migration, "migration.sql")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || `Apply ${migration}`);
  };
  let created = false;
  try {
    await maintenance.$executeRawUnsafe(`CREATE DATABASE "${name}"`); created = true;
    for (const migration of migrations.filter(m => m < latest)) apply(migration);
    const owner = await db.user.create({ data: { name: "Machine QA", username: randomUUID(), passwordHash: "test-only-not-a-login", role: "ADMIN" } });
    const customer = await db.customer.create({ data: { customerCode: "QA-CUSTOMER", type: "GYM", name: "Isolated machine QA", primaryMobile: "9000000000", address: "QA", city: "Vellore", state: "Tamil Nadu", pinCode: "632001" } });
    const original = await db.customerEquipment.create({ data: { equipmentCode: "VFE-EQP-0010", customerId: customer.id, name: "Legacy treadmill", serialNumber: "ORIGINAL-SERIAL" } });
    await db.documentSequence.create({ data: { key: "equipment", value: 0 } });
    const bill = await db.billDetail.create({ data: { billNumber: "QA-LEGACY", billDate: new Date(), customerId: customer.id, createdById: owner.id, total: 500 } });
    // Seed the historical schema without referring to fields added by later migrations.
    const [legacy] = await db.$queryRaw<{ id: string }[]>`INSERT INTO "BillDetailItem" ("id", "billDetailId", "equipmentId", "itemName", "brand", "quantity", "unitPrice", "amount") VALUES (${randomUUID()}, ${bill.id}, ${original.id}, 'Legacy treadmill', 'QA', 5, 100, 500) RETURNING "id"`;
    const complaint = await db.serviceComplaint.create({ data: { complaintNumber: "QA-ORIGINAL", customerId: customer.id, equipmentId: original.id, createdById: owner.id, customerComplaint: "Original machine history" } });
    const history = await db.serviceRecord.create({ data: { serviceNumber: "QA-SERVICE", complaintId: complaint.id, customerId: customer.id, equipmentId: original.id, serviceDate: new Date(), complaintReported: "Original machine history", problemFound: "Original fault", workDone: "Original repair", partsSummary: "None", customerNameSnapshot: customer.name, customerPhoneSnapshot: customer.primaryMobile, customerAddressSnapshot: customer.address, warrantyStatus: "UNKNOWN" } });
    for (const migration of migrations.filter(m => m >= latest)) apply(migration);
    const upgraded = await db.billDetailItem.findUniqueOrThrow({ where: { id: legacy.id }, include: { units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } });
    assert.equal(upgraded.units.length, 5); assert.equal(upgraded.equipmentId, original.id);
    assert.equal(upgraded.units[0].equipmentId, original.id);
    assert.equal(new Set(upgraded.units.map(u => u.equipment.equipmentCode)).size, 5);
    assert.equal((await db.serviceRecord.findUniqueOrThrow({ where: { id: history.id } })).equipmentId, original.id);
    assert.equal(Number((await db.billDetail.findUniqueOrThrow({ where: { id: bill.id } })).total), 500);
    assert.equal(upgraded.units.filter(u => u.equipment.serialNumber).length, 1);
    assert.equal(upgraded.quantityUnit, "UNIT");
    console.log("PASS Existing quantity-5 bill upgrades to five machines; original ID, serial, repair history and total preserved");

    const input: BillItemInput = { itemName: "QA treadmill", brand: "QA", modelNumber: "M5", serialNumber: "S-1", serialNumbers: ["S-1", "S-2", "S-3", "S-4", "S-5"], quantity: 5, quantityUnit: "UNIT", unitPrice: 100, amount: 500, installationDate: null, warrantyStartDate: new Date("2026-01-01"), warrantyExpiryDate: new Date("2027-01-01"), warrantyDuration: "12 Months", notes: null };
    const second = await db.billDetail.create({ data: { billNumber: "QA-FIVE", billDate: new Date(), customerId: customer.id, createdById: owner.id, total: 500 } });
    const createdUnits = await db.$transaction(tx => createPurchasedProducts(tx, second, [input]));
    assert.equal(createdUnits.equipmentIds.length, 5);
    const load = () => db.billDetailItem.findFirstOrThrow({ where: { billDetailId: second.id }, include: { billDetail: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" as const } } } });
    let item = await load();
    const initialIds = item.units.map(u => u.equipmentId);
    assert.equal(Number(item.quantity), 5); assert.equal(Number(item.amount), 500);
    assert.equal(new Set(item.units.map(u => u.equipment.serialNumber)).size, 5);
    console.log("PASS New quantity-5 purchase is one bill line, five machines, unique serials/codes and correct amount");
    await db.$transaction(tx => updatePurchasedProduct(tx, item, { ...input, quantity: 7, amount: 700, serialNumbers: Array(7).fill(undefined) }, null));
    item = await load(); assert.equal(item.units.length, 7);
    assert.deepEqual(item.units.slice(0, 5).map(u => u.equipmentId), initialIds);
    const addedIds = item.units.slice(5).map(u => u.equipmentId);
    await db.$transaction(tx => updatePurchasedProduct(tx, item, { ...input, serialNumbers: Array(5).fill(undefined) }, null));
    item = await load(); assert.equal(item.units.length, 5);
    assert.equal(await db.customerEquipment.count({ where: { id: { in: addedIds } } }), 0);
    console.log("PASS Quantity increases and safe reductions preserve original machine identities and remove unused extras");
    await db.customerEquipment.update({ where: { id: initialIds[3] }, data: { warrantyExpiryDate: new Date("2028-01-01") } });
    item = await load();
    await db.$transaction(tx => updatePurchasedProduct(tx, item, { ...input, unitPrice: 120, amount: 600, serialNumbers: Array(5).fill(undefined) }, null));
    assert.equal((await db.customerEquipment.findUniqueOrThrow({ where: { id: initialIds[3] } })).warrantyExpiryDate?.toISOString().slice(0, 10), "2028-01-01");
    console.log("PASS Price-only edits do not overwrite an individual machine's warranty");
    item = await load();
    await db.$transaction(tx => updatePurchasedProduct(tx, item, { ...input, serialNumbers: ["S-2", "S-1", "S-3", "S-4", "S-5"] }, null));
    item = await load(); assert.equal(item.units[0].equipment.serialNumber, "S-2"); assert.equal(item.units[1].equipment.serialNumber, "S-1");
    console.log("PASS Individual serial updates/swaps are atomic and do not change machine IDs");
    await db.serviceComplaint.create({ data: { complaintNumber: "QA-MACHINE-3", customerId: customer.id, equipmentId: initialIds[2], createdById: owner.id, customerComplaint: "Third machine only" } });
    await assert.rejects(db.$transaction(tx => updatePurchasedProduct(tx, item, { ...input, quantity: 2, amount: 200, serialNumbers: [undefined, undefined] }, null)), /Quantity cannot be reduced/);
    assert.equal((await load()).units.length, 5);
    assert.equal(await db.serviceComplaint.count({ where: { equipmentId: initialIds[1] } }), 0);
    assert.equal(await db.serviceComplaint.count({ where: { equipmentId: initialIds[2] } }), 1);
    console.log("PASS A complaint belongs only to its machine; reductions cannot remove a machine with history");
    const before = await db.customerEquipment.count();
    await assert.rejects(db.$transaction(tx => createPurchasedProducts(tx, second, [{ ...input, serialNumbers: ["DUP", "dup", null, null, null] }])), /repeated/);
    assert.equal(await db.customerEquipment.count(), before);
    await assert.rejects(db.$transaction(tx => createPurchasedProducts(tx, second, [{ ...input, serialNumbers: ["original-serial", null, null, null, null] }])), /already registered/);
    assert.equal(await db.customerEquipment.count(), before);
    await db.$transaction(tx => createPurchasedProducts(tx, second, [{ ...input, serialNumber: null, serialNumbers: Array(5).fill(null) }]));
    console.log("PASS Duplicate serials roll back completely; five machines without serials are supported");

    const kgBill = await db.billDetail.create({ data: { billNumber: "QA-KG", billDate: new Date(), customerId: customer.id, createdById: owner.id, total: 2550 } });
    const kgInput: BillItemInput = { ...input, itemName: "Dumbbells", quantity: 25.5, quantityUnit: "KG", amount: 2550, serialNumber: "IGNORED", serialNumbers: ["IGNORED"] };
    await db.$transaction(tx => createPurchasedProducts(tx, kgBill, [kgInput]));
    const loadKg = () => db.billDetailItem.findFirstOrThrow({ where: { billDetailId: kgBill.id }, include: { billDetail: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" as const } } } });
    let kg = await loadKg();
    const kgId = kg.equipmentId!;
    assert.equal(kg.quantityUnit, "KG"); assert.equal(Number(kg.quantity), 25.5); assert.equal(Number(kg.amount), 2550);
    assert.equal(kg.units.length, 1); assert.equal(kg.units[0].equipment.serialNumber, null); assert.equal(kg.serialNumber, null);
    await db.$transaction(tx => updatePurchasedProduct(tx, kg, { ...kgInput, quantity: 5000.25, amount: 500025 }, null));
    kg = await loadKg(); assert.equal(kg.units.length, 1); assert.equal(kg.equipmentId, kgId); assert.equal(Number(kg.quantity), 5000.25);
    await db.$transaction(tx => updatePurchasedProduct(tx, kg, { ...kgInput, quantity: 0.25, amount: 25 }, null));
    kg = await loadKg(); assert.equal(kg.equipmentId, kgId); assert.equal(Number(kg.quantity), 0.25);
    console.log("PASS Kg purchases persist decimal weight and per-Kg amount, ignore serial payloads and retain one grouped product across weight edits");

    const mixedBill = await db.billDetail.create({ data: { billNumber: "QA-MIXED", billDate: new Date(), customerId: customer.id, createdById: owner.id, total: 505025 } });
    const mixed = await db.$transaction(tx => createPurchasedProducts(tx, mixedBill, [{ ...input, serialNumbers: [] }, { ...kgInput, quantity: 5000.25, amount: 500025 }]));
    assert.equal(mixed.equipmentIds.length, 6, "5 Unit machines plus one Kg group, never 5005 machines");
    const conversion = await db.billDetailItem.findFirstOrThrow({ where: { billDetailId: mixedBill.id, quantityUnit: "UNIT" }, include: { billDetail: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } });
    const originalIds = conversion.units.map(unit => unit.equipmentId);
    await db.$transaction(tx => updatePurchasedProduct(tx, conversion, { ...kgInput, quantity: 10.5, amount: 1050 }, null));
    let converted = await db.billDetailItem.findUniqueOrThrow({ where: { id: conversion.id }, include: { billDetail: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } });
    assert.equal(converted.quantityUnit, "KG"); assert.equal(converted.units.length, 1); assert.equal(converted.equipmentId, originalIds[0]);
    assert.equal(await db.customerEquipment.count({ where: { id: { in: originalIds.slice(1) } } }), 0);
    await db.$transaction(tx => updatePurchasedProduct(tx, converted, { ...input, quantity: 2, amount: 200, serialNumbers: [] }, null));
    converted = await db.billDetailItem.findUniqueOrThrow({ where: { id: conversion.id }, include: { billDetail: true, units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } });
    assert.equal(converted.quantityUnit, "UNIT"); assert.equal(converted.units.length, 2); assert.equal(converted.equipmentId, originalIds[0]);
    console.log("PASS Mixed Unit/Kg bills count tracked products correctly; unused products can change Unit/Kg without losing the retained product ID");

    await db.serviceComplaint.create({ data: { complaintNumber: "QA-KG-PROBLEM", customerId: customer.id, equipmentId: kgId, createdById: owner.id, customerComplaint: "Problem in the weight-based purchase" } });
    kg = await loadKg();
    await assert.rejects(db.$transaction(tx => updatePurchasedProduct(tx, kg, { ...input, quantity: 1, amount: 100, serialNumbers: [] }, null)), /Cannot change Unit\/Kg/);
    await assert.rejects(db.$transaction(tx => assertMachinesUnused(tx, [kgId])), /complaint or service history/);
    await assert.rejects(db.$transaction(tx => updatePurchasedProduct(tx, item, kgInput, null)), /Cannot change Unit\/Kg/);
    assert.equal((await loadKg()).quantityUnit, "KG"); assert.equal((await load()).units.length, 5);
    const disposable = await db.billDetailItem.findFirstOrThrow({ where: { billDetailId: mixedBill.id, quantityUnit: "KG" }, include: { units: true } });
    await db.$transaction(async tx => { await assertMachinesUnused(tx, disposable.units.map(unit => unit.equipmentId)); await tx.billDetailItem.delete({ where: { id: disposable.id } }); await deleteUnusedBillMachines(tx, disposable.units.map(unit => unit.equipmentId), mixedBill.billNumber); });
    assert.equal(await db.customerEquipment.count({ where: { id: { in: disposable.units.map(unit => unit.equipmentId) } } }), 0);
    console.log("PASS Kg complaints remain linked to the grouped product; history prevents Unit/Kg conversion/deletion; unused Kg groups delete safely");

    await assert.rejects(db.billDetailItem.create({ data: { billDetailId: mixedBill.id, itemName: "Invalid fractional Unit", quantity: 2.5, quantityUnit: "UNIT" } }));
    await assert.rejects(db.billDetailItem.create({ data: { billDetailId: mixedBill.id, itemName: "Invalid Kg", quantity: 0, quantityUnit: "KG" } }));
    console.log("PASS Database constraints reject fractional Unit counts and zero Kg quantities");

    const editBill = await db.billDetail.create({ data: { billNumber: "QA-EDITOR", billDate: new Date("2026-01-01"), customerId: customer.id, createdById: owner.id, total: 2750 } });
    await db.$transaction(tx => createPurchasedProducts(tx, editBill, [{ ...input, quantity: 2, amount: 200, serialNumbers: ["EDIT-1", "EDIT-2"] }, { ...kgInput, serialNumbers: [] }]));
    const loadEditor = () => db.billDetail.findUniqueOrThrow({ where: { id: editBill.id }, include: { customer: true, items: { include: { units: { include: { equipment: true }, orderBy: { unitNumber: "asc" as const } } }, orderBy: { createdAt: "asc" as const } } } });
    const editorInput = (saved: Awaited<ReturnType<typeof loadEditor>>): BillEditorInput => ({
      billNumber: saved.billNumber, billDate: saved.billDate, expectedBillVersion: saved.updatedAt.toISOString(), expectedCustomerVersion: saved.customer.updatedAt.toISOString(),
      customer: { name: saved.customer.name, type: saved.customer.type, primaryMobile: saved.customer.primaryMobile, address: saved.customer.address, city: saved.customer.city, state: saved.customer.state, pinCode: saved.customer.pinCode },
      products: saved.items.map(line => ({ itemId: line.id, expectedUnits: line.units.map(unit => `${unit.equipmentId}:${unit.equipment.updatedAt.toISOString()}`).join(","), data: { ...input, itemName: line.itemName, quantity: Number(line.quantity), quantityUnit: line.quantityUnit, unitPrice: Number(line.unitPrice), amount: Number(line.amount), serialNumber: line.serialNumber, serialNumbers: line.quantityUnit === "KG" ? [] : line.units.map(unit => unit.equipment.serialNumber), warrantyStartDate: line.warrantyStartDate, warrantyExpiryDate: line.warrantyExpiryDate, warrantyDuration: line.warrantyDuration } })),
    });
    let savedEditor = await loadEditor();
    const initialMachineIds = savedEditor.items.find(line => line.quantityUnit === "UNIT")!.units.map(unit => unit.equipmentId);
    let editInput = editorInput(savedEditor);
    editInput.billNumber = "QA-EDITOR-UPDATED"; editInput.billDate = new Date("2026-10-16"); editInput.customer.name = "Edited profile"; editInput.customer.primaryMobile = "9111111111";
    editInput.products.find(product => product.data.quantityUnit === "UNIT")!.data = { ...input, quantity: 3, amount: 300, serialNumbers: ["EDIT-1", "EDIT-2", "EDIT-3"], warrantyExpiryDate: new Date("2029-01-01") };
    editInput.products.find(product => product.data.quantityUnit === "KG")!.data = { ...kgInput, quantity: 0.5, amount: 50, serialNumbers: [] };
    editInput.products.push({ itemId: null, expectedUnits: null, data: { ...input, itemName: "Additional product", quantity: 1, amount: 100, serialNumbers: ["EDIT-NEW"] } });
    await db.$transaction(tx => saveBillEditor(tx, editBill.id, editInput), { timeout: 60000 });
    savedEditor = await loadEditor();
    assert.equal(savedEditor.billNumber, "QA-EDITOR-UPDATED"); assert.equal(savedEditor.customer.name, "Edited profile"); assert.equal(savedEditor.customer.primaryMobile, "9111111111"); assert.equal(Number(savedEditor.total), 450);
    assert.equal(savedEditor.items.length, 3);
    assert(savedEditor.items.flatMap(line => line.units).every(unit => unit.equipment.invoiceNumber === "QA-EDITOR-UPDATED" && unit.equipment.purchaseDate?.toISOString().startsWith("2026-10-16")));
    assert(initialMachineIds.every(id => savedEditor.items.flatMap(line => line.units).some(unit => unit.equipmentId === id)));
    assert.equal(savedEditor.items.find(line => line.quantityUnit === "UNIT" && Number(line.quantity) === 3)?.warrantyExpiryDate?.toISOString().slice(0, 10), "2029-01-01");
    console.log("PASS Full editor saves invoice, date, customer, products, Unit/Kg quantities and warranty atomically while preserving existing machine IDs");

    const stale = { ...editorInput(savedEditor), expectedBillVersion: "outdated" };
    await assert.rejects(db.$transaction(tx => saveBillEditor(tx, editBill.id, stale)), /changed by another user/);
    const foreign = editorInput(savedEditor); foreign.products[0].itemId = legacy.id;
    await assert.rejects(db.$transaction(tx => saveBillEditor(tx, editBill.id, foreign)), /product list has changed/);
    const duplicate = editorInput(savedEditor); duplicate.billNumber = "QA-LEGACY";
    const beforeRollback = JSON.stringify(await loadEditor());
    await assert.rejects(db.$transaction(tx => saveBillEditor(tx, editBill.id, duplicate), { timeout: 60000 }));
    assert.equal(JSON.stringify(await loadEditor()), beforeRollback);
    editInput = editorInput(savedEditor);
    const removed = editInput.products.find(product => product.data.quantityUnit === "KG")!;
    const removedEquipment = savedEditor.items.find(line => line.id === removed.itemId)!.units[0].equipmentId;
    editInput.products = editInput.products.filter(product => product !== removed);
    await db.$transaction(tx => saveBillEditor(tx, editBill.id, editInput), { timeout: 60000 });
    assert.equal(await db.customerEquipment.count({ where: { id: removedEquipment } }), 0);
    assert.equal(Number((await loadEditor()).total), 400);
    savedEditor = await loadEditor();
    editInput = editorInput(savedEditor); editInput.billNumber = "QA-EDITOR-REDUCED";
    const reduce = editInput.products.find(product => product.data.quantity === 3)!;
    const retiredId = savedEditor.items.find(line => line.id === reduce.itemId)!.units[2].equipmentId;
    reduce.data = { ...reduce.data, quantity: 2, amount: 200, serialNumbers: reduce.data.serialNumbers.slice(0, 2) };
    await db.$transaction(tx => saveBillEditor(tx, editBill.id, editInput), { timeout: 60000 });
    assert.equal(await db.customerEquipment.count({ where: { id: retiredId } }), 0);
    assert.equal(Number((await loadEditor()).total), 300);
    console.log("PASS Full editor rejects stale/foreign/duplicate-invoice submissions without partial writes and safely removes an unused product");

    savedEditor = await loadEditor();
    const protectedId = savedEditor.items.find(line => line.units.length > 1)!.units[1].equipmentId;
    await db.$transaction(async tx => { await lockEquipmentBills(tx, protectedId); await tx.serviceComplaint.create({ data: { complaintNumber: "QA-EDITOR-COMPLAINT", customerId: customer.id, equipmentId: protectedId, createdById: owner.id, customerComplaint: "A complaint against a secondary machine" } }); });
    const protectedSnapshot = JSON.stringify(await loadEditor());
    await assert.rejects(db.$transaction(tx => assertBillEditable(tx, editBill.id)), /complaint has already been raised/);
    await assert.rejects(db.$transaction(tx => saveBillEditor(tx, editBill.id, editorInput(savedEditor))), /complaint has already been raised/);
    assert.equal(JSON.stringify(await loadEditor()), protectedSnapshot);
    console.log("PASS Any complaint on any product blocks the complete invoice edit, including an already-open form, without changing data");
    await db.serviceRecord.update({ where: { id: history.id }, data: { charges: 25, warrantyStatus: "UNDER_WARRANTY" } });
    await db.serviceCollection.create({ data: { collectionNumber: "QA-DASHBOARD", serviceRecordId: history.id, complaintId: complaint.id, customerId: customer.id, equipmentId: original.id, collectedById: owner.id, amount: 12.5, paymentMode: "CASH" } });
    const summary = await getDashboardSummary(db, new Date("2020-01-01"), new Date("2030-01-01"), new Date("2020-01-01"));
    assert.equal(summary.customers, await db.customer.count()); assert.equal(summary.equipment, await db.customerEquipment.count());
    assert.equal(summary.newComplaints, await db.serviceComplaint.count()); assert.equal(summary.completedToday, await db.serviceRecord.count());
    assert.equal(summary.pending, await db.serviceComplaint.count({ where: { status: { notIn: ["SERVICE_COMPLETED", "CLOSED", "CANCELLED"] } } }));
    assert.equal(summary.warrantyServices, 1); assert.equal(Number(summary.monthServiceValue), 25); assert.equal(Number(summary.monthCollectedValue), 12.5); assert.equal(Number(summary.paidForMonthlyServices), 12.5);
    console.log("PASS Single-query dashboard metrics match original counts and preserve service/collection totals");
    const loginPassword = "Isolated-test-password-42";
    const loginUser = await db.user.create({ data: { name: "QA login", username: "qa-technician", email: requiredEmail(" QA-Tech@Example.test "), passwordHash: await bcrypt.hash(loginPassword, 4), role: "TECHNICIAN" } });
    const loginTechnician = await db.technician.create({ data: { technicianCode: "QA-LOGIN", name: "QA login", mobile: "9000000001", email: loginUser.email, userId: loginUser.id } });
    for (const identifier of ["qa-technician", "QA-TECH@EXAMPLE.TEST"]) {
      const loggedIn = await authenticateCredentials({ username: identifier, password: loginPassword }, where => db.user.findMany({ where, take: 2, include: { technician: { select: { id: true, isActive: true } } } }));
      assert.equal(loggedIn?.id, loginUser.id); assert.equal(loggedIn?.technicianId, loginTechnician.id);
    }
    await assert.rejects(assertLoginIdentifiers(db, "different-username", "QA-TECH@EXAMPLE.TEST"), /already in use/);
    await assert.rejects(assertLoginIdentifiers(db, "qa-tech@example.test", "another@example.test"), /already in use/);
    await assertLoginIdentifiers(db, loginUser.username, loginUser.email!, loginUser.id);
    console.log("PASS Technician email and username both authenticate against PostgreSQL; normalized and cross-field duplicate identities are rejected");
  } finally {
    await db.$disconnect();
    if (created) { await maintenance.$executeRawUnsafe(`DROP DATABASE "${name}"`); console.log("Cleanup: only the isolated machine-test database was removed."); }
    await maintenance.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
