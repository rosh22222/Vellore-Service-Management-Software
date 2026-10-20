import type { Prisma } from "@prisma/client";
import { assertMachinesUnused, PROTECTED_MACHINE_MESSAGE } from "./bill-equipment";
import { lockBill } from "./bill-transaction";
export const BILL_EDIT_BLOCKED = "Cannot edit this bill. A complaint has already been raised for a product on this invoice.";

export async function assertBillEditable(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.billDetail.findUnique({ where: { id: billId }, select: { items: { select: { equipmentId: true, units: { select: { equipmentId: true } } } } } });
  if (!bill) throw new Error("Bill detail not found.");
  const ids = [...new Set(bill.items.flatMap(item => [item.equipmentId, ...item.units.map(unit => unit.equipmentId)]).filter((id): id is string => Boolean(id)))];
  try { await assertMachinesUnused(tx, ids); }
  catch (error) { if (error instanceof Error && error.message === PROTECTED_MACHINE_MESSAGE) throw new Error(BILL_EDIT_BLOCKED); throw error; }
}

// Every entry point that attaches a complaint must serialize with full-bill edits.
export async function lockEquipmentBills(tx: Prisma.TransactionClient, equipmentId: string) {
  const bills = await tx.billDetail.findMany({ where: { items: { some: { OR: [{ equipmentId }, { units: { some: { equipmentId } } }] } } }, select: { id: true }, orderBy: { id: "asc" } });
  for (const bill of bills) await lockBill(tx, bill.id);
}
