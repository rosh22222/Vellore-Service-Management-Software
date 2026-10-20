import type { Prisma } from "@prisma/client";
import { lockBill } from "./bill-transaction";
import { assertBillEditable } from "./bill-edit";
import { createPurchasedProducts, deleteUnusedBillMachines, updatePurchasedProduct, type BillItemInput } from "./bill-equipment";
import { MAX_BILL_MACHINES, trackedProductCount, validateMachineSerials } from "./bill-quantity";

export type BillEditorInput = {
  billNumber: string; billDate: Date; expectedBillVersion: string; expectedCustomerVersion: string;
  customer: Pick<Prisma.CustomerUncheckedUpdateInput, "name" | "type" | "primaryMobile" | "alternateMobile" | "email" | "address" | "city" | "state" | "pinCode" | "gstNumber" | "notes">;
  products: { itemId: string | null; expectedUnits: string | null; data: BillItemInput }[];
};

export async function saveBillEditor(tx: Prisma.TransactionClient, id: string, input: BillEditorInput) {
  await lockBill(tx, id);
  await assertBillEditable(tx, id);
  const bill = await tx.billDetail.findUnique({ where: { id }, include: { customer: true, items: { include: { units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } } } } } });
  if (!bill) throw new Error("Bill detail not found.");
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${bill.customerId} FOR UPDATE`;
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: bill.customerId }, select: { updatedAt: true } });
  if (bill.updatedAt.toISOString() !== input.expectedBillVersion || customer.updatedAt.toISOString() !== input.expectedCustomerVersion) throw new Error("This bill or customer was changed by another user. Reopen Edit Bill before saving.");
  if (!input.products.length || input.products.length > 50) throw new Error("A bill must contain between 1 and 50 products.");
  if (input.products.reduce((sum, product) => sum + trackedProductCount(product.data), 0) > MAX_BILL_MACHINES) throw new Error("Too many tracked products in this bill.");
  validateMachineSerials(input.products.flatMap(product => product.data.serialNumbers));
  const total = input.products.reduce((sum, product) => sum + product.data.amount, 0);
  if (!Number.isFinite(total) || total > 9999999999.99) throw new Error("Bill total is too large.");
  const ids = input.products.map(product => product.itemId).filter((value): value is string => Boolean(value));
  if (new Set(ids).size !== ids.length || ids.some(itemId => !bill.items.some(item => item.id === itemId))) throw new Error("The product list has changed. Reopen this bill before saving.");
  for (const removed of bill.items.filter(item => !ids.includes(item.id))) {
    const equipmentIds = removed.units.map(unit => unit.equipmentId);
    await tx.billDetailItem.delete({ where: { id: removed.id } });
    await deleteUnusedBillMachines(tx, equipmentIds, bill.billNumber);
  }
  const updatedBill = { ...bill, billNumber: input.billNumber, billDate: input.billDate };
  const equipmentIds: string[] = [];
  for (const product of input.products) {
    if (product.itemId) {
      const existing = bill.items.find(item => item.id === product.itemId)!;
      // Retire old units against the original invoice reference. All retained
      // and newly added machines receive the new reference/date together below.
      equipmentIds.push(...await updatePurchasedProduct(tx, { ...existing, billDetail: bill }, product.data, product.expectedUnits));
    } else {
      equipmentIds.push(...(await createPurchasedProducts(tx, updatedBill, [product.data])).equipmentIds);
    }
  }
  await tx.customer.update({ where: { id: bill.customerId }, data: input.customer });
  await tx.billDetail.update({ where: { id }, data: { billNumber: input.billNumber, billDate: input.billDate, total } });
  await tx.customerEquipment.updateMany({ where: { id: { in: equipmentIds } }, data: { invoiceNumber: input.billNumber, purchaseDate: input.billDate } });
  return { customerId: bill.customerId, equipmentIds };
}
