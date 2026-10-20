"use server";

import { EquipmentStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/ids";
import { optionalDate, optionalString, requiredText } from "@/lib/format";
import { billTransaction, lockBill } from "@/lib/bill-transaction";
import { assertBillEditable } from "@/lib/bill-edit";

export async function createEquipment(formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const customerId = String(formData.get("customerId") ?? "");
  const name = requiredText(formData.get("name"), "Equipment name", 200);
  if (!customerId) throw new Error("Customer is required.");
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found.");
  const status = String(formData.get("status") || "ACTIVE");
  if (!Object.values(EquipmentStatus).includes(status as EquipmentStatus))
    throw new Error("Invalid equipment status.");
  const equipment = await db.$transaction(async (tx) => {
    const equipmentCode = await nextDocumentNumber(tx, "equipment", "VFE-EQP-");
    const row = await tx.customerEquipment.create({
      data: {
        equipmentCode,
        customerId,
        name,
        brand: optionalString(formData.get("brand")),
        modelNumber: optionalString(formData.get("modelNumber")),
        serialNumber: optionalString(formData.get("serialNumber")),
        purchaseDate: optionalDate(formData.get("purchaseDate")),
        invoiceNumber: optionalString(formData.get("invoiceNumber")),
        installationDate: optionalDate(formData.get("installationDate")),
        warrantyStartDate: optionalDate(formData.get("warrantyStartDate")),
        warrantyExpiryDate: optionalDate(formData.get("warrantyExpiryDate")),
        warrantyDuration: optionalString(formData.get("warrantyDuration")),
        status: status as EquipmentStatus,
        notes: optionalString(formData.get("notes")),
      },
    });
    return row;
  });
  revalidateTag("equipment-options");
  revalidatePath("/equipment");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/equipment/${equipment.id}`);
}

export async function updateEquipment(id: string, formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const before = await db.customerEquipment.findUnique({
    where: { id },
    include: {
      billDetailItems: {
        select: {
          billDetailId: true,
          quantityUnit: true,
          billDetail: { select: { id: true, billNumber: true } },
        },
      },
      billDetailUnits: { include: { billDetailItem: { include: { billDetail: true } } } },
    },
  });
  if (!before) throw new Error("Equipment not found.");
  const status = String(formData.get("status") || before.status);
  if (!Object.values(EquipmentStatus).includes(status as EquipmentStatus))
    throw new Error("Invalid equipment status.");
  const name = requiredText(formData.get("name"), "Equipment name", 200);
  const linkedItems = [...before.billDetailItems, ...before.billDetailUnits.map(unit => unit.billDetailItem)];
  const isKg = linkedItems.some(item => item.quantityUnit === "KG");
  const linkedBillIds = [...new Set(linkedItems.map(item => item.billDetailId))];
  const linkedBillNumbers = [
    ...new Set(linkedItems.map((item) => item.billDetail.billNumber)),
  ];
  const requestedInvoiceNumber = optionalString(formData.get("invoiceNumber"));
  const resolvedInvoiceNumber =
    linkedBillNumbers.length === 1
      ? (requestedInvoiceNumber ?? linkedBillNumbers[0])
      : requestedInvoiceNumber;

  if (
    linkedBillNumbers.length > 1 &&
    requestedInvoiceNumber &&
    !linkedBillNumbers.includes(requestedInvoiceNumber)
  ) {
    throw new Error(
      "This equipment is linked with multiple bill references. Update the bill reference from Bill Details.",
    );
  }

  const result = await billTransaction(async (tx) => {
    for (const billId of [...linkedBillIds].sort()) await lockBill(tx, billId);
    if (requestedInvoiceNumber && linkedBillNumbers.some(number => number !== requestedInvoiceNumber)) {
      for (const billId of linkedBillIds) await assertBillEditable(tx, billId);
    }
    const row = await tx.customerEquipment.update({
      where: { id },
      data: {
        name,
        brand: optionalString(formData.get("brand")),
        modelNumber: optionalString(formData.get("modelNumber")),
        serialNumber: isKg ? null : optionalString(formData.get("serialNumber")),
        purchaseDate: optionalDate(formData.get("purchaseDate")),
        invoiceNumber: resolvedInvoiceNumber,
        installationDate: optionalDate(formData.get("installationDate")),
        warrantyStartDate: optionalDate(formData.get("warrantyStartDate")),
        warrantyExpiryDate: optionalDate(formData.get("warrantyExpiryDate")),
        warrantyDuration: optionalString(formData.get("warrantyDuration")),
        status: status as EquipmentStatus,
        notes: optionalString(formData.get("notes")),
      },
    });

    if (
      linkedBillIds.length === 1 &&
      requestedInvoiceNumber &&
      requestedInvoiceNumber !== linkedBillNumbers[0]
    ) {
      await tx.billDetail.update({
        where: { id: linkedBillIds[0] },
        data: { billNumber: requestedInvoiceNumber },
      });
      const billEquipmentLinks = await tx.billDetailItem.findMany({
        where: { billDetailId: linkedBillIds[0] },
        select: { equipmentId: true, units: { select: { equipmentId: true } } },
      });
      const billEquipmentIds = billEquipmentLinks
        .flatMap((link) => [link.equipmentId, ...link.units.map(unit => unit.equipmentId)])
        .filter((value): value is string => Boolean(value));
      if (billEquipmentIds.length) {
        await tx.customerEquipment.updateMany({
          where: { id: { in: billEquipmentIds } },
          data: { invoiceNumber: requestedInvoiceNumber },
        });
      }
    }

    await tx.billDetailItem.updateMany({
      where: { OR: [{ equipmentId: id }, { units: { some: { equipmentId: id } } }], AND: [{ OR: [{ quantityUnit: "KG" }, { quantityUnit: "UNIT", quantity: 1 }] }] },
      data: {
        itemName: row.name,
        brand: row.brand,
        modelNumber: row.modelNumber,
        serialNumber: row.serialNumber,
        warrantyStartDate: row.warrantyStartDate,
        warrantyExpiryDate: row.warrantyExpiryDate,
        warrantyDuration: row.warrantyDuration,
      },
    });
    // Keep only the legacy first-unit serial alias in sync on a multi-unit line;
    // an individual machine edit must not rewrite its siblings' purchase data.
    await tx.billDetailItem.updateMany({ where: { equipmentId: id, quantityUnit: "UNIT", quantity: { gt: 1 } }, data: { serialNumber: row.serialNumber } });

    return { customerId: row.customerId, billIds: linkedBillIds };
  });
  revalidateTag("equipment-options");
  revalidatePath(`/equipment/${id}`);
  revalidatePath(`/equipment/${id}/edit`);
  revalidatePath("/equipment");
  revalidatePath(`/customers/${result.customerId}`);
  for (const billId of result.billIds) {
    revalidatePath(`/bill-details/${billId}`);
  }
  revalidatePath("/bill-details");
  revalidatePath("/complaints");
  revalidatePath("/service-history");
  redirect(`/equipment/${id}?updated=1`);
}
