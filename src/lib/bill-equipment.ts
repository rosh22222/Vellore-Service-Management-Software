import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { nextDocumentNumbers } from "./ids";
import { trackedProductCount, validateMachineSerials, type ProductQuantityUnit } from "./bill-quantity";

export type BillItemInput = {
  itemName: string; brand: string; modelNumber: string | null;
  serialNumber: string | null; serialNumbers: (string | null | undefined)[];
  installationDate: Date | null; quantity: number; quantityUnit: ProductQuantityUnit; unitPrice: number; amount: number;
  warrantyStartDate: Date | null; warrantyExpiryDate: Date | null;
  warrantyDuration: string | null; notes: string | null;
};
type Bill = { id: string; customerId: string; billNumber: string; billDate: Date };
export const PROTECTED_MACHINE_MESSAGE = "Cannot delete this bill/item because its equipment already has complaint or service history.";

async function availableSerials(tx: Prisma.TransactionClient, values: readonly (string | null | undefined)[], except: string[] = []) {
  validateMachineSerials(values);
  const serials = values.filter((v): v is string => Boolean(v));
  if (!serials.length) return;
  const duplicate = await tx.customerEquipment.findFirst({
    where: { serialNumber: { in: serials, mode: "insensitive" }, ...(except.length ? { id: { notIn: except } } : {}) },
    select: { serialNumber: true },
  });
  if (duplicate) throw new Error(`Serial number "${duplicate.serialNumber}" is already registered. Each machine must have a different serial, or leave it blank.`);
}

function machineData(bill: Bill, item: BillItemInput, id: string, equipmentCode: string, serialNumber: string | null) {
  return { id, equipmentCode, customerId: bill.customerId, name: item.itemName, brand: item.brand,
    modelNumber: item.modelNumber, serialNumber, purchaseDate: bill.billDate, invoiceNumber: bill.billNumber,
    installationDate: item.installationDate, warrantyStartDate: item.warrantyStartDate,
    warrantyExpiryDate: item.warrantyExpiryDate, warrantyDuration: item.warrantyDuration, notes: item.notes };
}

export async function createPurchasedProducts(tx: Prisma.TransactionClient, bill: Bill, items: BillItemInput[]) {
  const count = items.reduce((n, item) => n + trackedProductCount(item), 0);
  await availableSerials(tx, items.flatMap(item => item.quantityUnit === "KG" ? [] : item.serialNumbers));
  const codes = await nextDocumentNumbers(tx, "equipment", "VFE-EQP-", count);
  let cursor = 0;
  const lines = items.map(item => ({ id: randomUUID(), item, machines: Array.from({ length: trackedProductCount(item) }, (_, index) =>
    ({ id: randomUUID(), code: codes[cursor++], serial: item.quantityUnit === "KG" ? null : item.serialNumbers[index] ?? null, number: index + 1 })) }));
  await tx.customerEquipment.createMany({ data: lines.flatMap(line => line.machines.map(machine => machineData(bill, line.item, machine.id, machine.code, machine.serial))) });
  await tx.billDetailItem.createMany({ data: lines.map(({ id, item, machines }) => {
    const { serialNumbers, installationDate, ...data } = item;
    return { ...data, id, billDetailId: bill.id, equipmentId: machines[0].id, serialNumber: machines[0].serial };
  }) });
  await tx.billDetailItemUnit.createMany({ data: lines.flatMap(line => line.machines.map(machine => ({ id: randomUUID(), billDetailItemId: line.id, equipmentId: machine.id, unitNumber: machine.number }))) });
  return { equipmentIds: lines.flatMap(line => line.machines.map(machine => machine.id)), itemName: items[0].itemName };
}

export async function assertMachinesUnused(tx: Prisma.TransactionClient, equipmentIds: string[]) {
  if (!equipmentIds.length) return;
  const [complaints, services] = await Promise.all([
    tx.serviceComplaint.count({ where: { equipmentId: { in: equipmentIds } } }),
    tx.serviceRecord.count({ where: { equipmentId: { in: equipmentIds } } }),
  ]);
  if (complaints || services) throw new Error(PROTECTED_MACHINE_MESSAGE);
}

export async function deleteUnusedBillMachines(tx: Prisma.TransactionClient, equipmentIds: string[], billNumber: string) {
  // Called after removing the line/unit links. Keep machines shared by another bill.
  await tx.customerEquipment.deleteMany({ where: { id: { in: equipmentIds }, invoiceNumber: billNumber,
    billDetailItems: { none: {} }, billDetailUnits: { none: {} }, complaints: { none: {} }, serviceRecords: { none: {} }, serviceCollections: { none: {} } } });
}

type SavedItem = Prisma.BillDetailItemGetPayload<{ include: { billDetail: true; units: { include: { equipment: true } } } }>;

export async function updatePurchasedProduct(tx: Prisma.TransactionClient, existing: SavedItem, item: BillItemInput, expectedUnits: string | null) {
  const units = [...existing.units].sort((a, b) => a.unitNumber - b.unitNumber);
  const version = units.map(unit => `${unit.equipmentId}:${unit.equipment.updatedAt.toISOString()}`).join(",");
  if (expectedUnits !== null && expectedUnits !== version) throw new Error("These machines were changed by another user. Reload the product before saving.");
  if (existing.quantityUnit !== item.quantityUnit) {
    try { await assertMachinesUnused(tx, units.map(unit => unit.equipmentId)); }
    catch { throw new Error("Cannot change Unit/Kg because this product has complaint or service history. Add a new product instead."); }
  }
  const count = trackedProductCount(item);
  const kept = units.slice(0, count), removed = units.slice(count);
  const keptIds = kept.map(unit => unit.equipmentId);
  const serials = Array.from({ length: count }, (_, i) => item.quantityUnit === "KG" ? null : item.serialNumbers[i] === undefined ? (kept[i]?.equipment.serialNumber ?? null) : item.serialNumbers[i] ?? null);
  await availableSerials(tx, serials, keptIds);
  if (removed.length) {
    try { await assertMachinesUnused(tx, removed.map(unit => unit.equipmentId)); }
    catch { throw new Error("Quantity cannot be reduced because a machine being removed has complaint or service history. Keep its quantity and history intact."); }
    await tx.billDetailItemUnit.deleteMany({ where: { id: { in: removed.map(unit => unit.id) } } });
    await deleteUnusedBillMachines(tx, removed.map(unit => unit.equipmentId), existing.billDetail.billNumber);
  }

  // Change shared machine properties only when the corresponding line field was
  // edited. A price-only edit must not reset an individual machine's warranty.
  const changes: Prisma.CustomerEquipmentUpdateManyMutationInput = {};
  const fields = { name: "itemName", brand: "brand", modelNumber: "modelNumber", warrantyStartDate: "warrantyStartDate", warrantyExpiryDate: "warrantyExpiryDate", warrantyDuration: "warrantyDuration", notes: "notes" } as const;
  for (const [machineField, lineField] of Object.entries(fields)) {
    const before = existing[lineField as keyof SavedItem];
    const after = item[lineField as keyof BillItemInput];
    if (String(before ?? "") !== String(after ?? "")) Object.assign(changes, { [machineField]: after });
  }
  if (String(kept[0]?.equipment.installationDate ?? "") !== String(item.installationDate ?? "")) changes.installationDate = item.installationDate;
  if (keptIds.length && Object.keys(changes).length) await tx.customerEquipment.updateMany({ where: { id: { in: keptIds } }, data: changes });
  const changedSerials = kept.filter((unit, i) => unit.equipment.serialNumber !== serials[i]).map((unit, i) => ({ id: unit.equipmentId, serial: serials[kept.indexOf(unit)] }));
  if (changedSerials.length) {
    await tx.customerEquipment.updateMany({ where: { id: { in: changedSerials.map(unit => unit.id) } }, data: { serialNumber: null } });
    await tx.$executeRaw`UPDATE "CustomerEquipment" e SET "serialNumber" = v.serial, "updatedAt" = CURRENT_TIMESTAMP FROM jsonb_to_recordset(${JSON.stringify(changedSerials)}::jsonb) AS v(id text, serial text) WHERE e.id = v.id`;
  }
  const addedIds: string[] = [];
  if (count > kept.length) {
    const codes = await nextDocumentNumbers(tx, "equipment", "VFE-EQP-", count - kept.length);
    const machines = codes.map((code, i) => ({ id: randomUUID(), code, number: kept.length + i + 1, serial: serials[kept.length + i] }));
    await tx.customerEquipment.createMany({ data: machines.map(machine => machineData(existing.billDetail, item, machine.id, machine.code, machine.serial)) });
    await tx.billDetailItemUnit.createMany({ data: machines.map(machine => ({ id: randomUUID(), billDetailItemId: existing.id, equipmentId: machine.id, unitNumber: machine.number })) });
    addedIds.push(...machines.map(machine => machine.id));
  }
  const { serialNumbers, installationDate, ...data } = item;
  await tx.billDetailItem.update({ where: { id: existing.id }, data: { ...data, equipmentId: keptIds[0] ?? addedIds[0], serialNumber: serials[0] } });
  return [...keptIds, ...addedIds];
}
