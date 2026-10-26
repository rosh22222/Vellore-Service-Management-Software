"use server";

import {
  ComplaintPriority,
  ComplaintSource,
  CustomerType,
  Prisma,
  ServiceStatus,
  TechnicianStatus,
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { indianPinCode, n, optionalDate, optionalString, phoneNumber, requiredText } from "@/lib/format";
import { nextDocumentNumber } from "@/lib/ids";
import { similarity } from "@/lib/similarity";
import { suggestedInvoiceNumber } from "@/lib/invoice-number";
import { billTransaction, lockBill } from "@/lib/bill-transaction";
import { createPurchasedProducts, updatePurchasedProduct, assertMachinesUnused, deleteUnusedBillMachines, type BillItemInput } from "@/lib/bill-equipment";
import { productQuantity, readQuantityUnit, trackedProductCount, MAX_BILL_MACHINES, validateMachineSerials } from "@/lib/bill-quantity";
import { assertBillEditable } from "@/lib/bill-edit";
import { saveBillEditor } from "@/lib/bill-editor";

const DELETE_PROTECTED_MESSAGE =
  "Cannot delete this bill/item because its equipment already has complaint or service history.";

function revalidateBillLookups() {
  revalidateTag("customer-options");
  revalidateTag("equipment-options");
}

function isProtectedDeleteError(error: unknown) {
  return error instanceof Error && error.message === DELETE_PROTECTED_MESSAGE;
}

export async function createBillDetail(formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  let billNumber = requiredText(
    formData.get("billNumber"),
    "Invoice No.",
    80,
  );
  const billDate = optionalDate(formData.get("billDate")) ?? new Date();
  const items = readBillItemInputs(formData, billDate);

  const bill = await billTransaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713042)`;
    const existing = await tx.billDetail.findUnique({
      where: { billNumber },
      select: { id: true },
    });
    if (existing) {
      if (formData.get("suggestedBillNumber") === billNumber && /^VFE-INV-\d+$/.test(billNumber)) {
        billNumber = await suggestedInvoiceNumber(tx);
      } else {
        throw new Error("This invoice number already exists. Open that bill or enter a different number.");
      }
    }

    const customerId = await resolveCustomer(tx, user.id, formData);
    const row = await tx.billDetail.create({
      data: {
        billNumber,
        billDate,
        customerId,
        createdById: user.id,
        total: items.reduce((sum, item) => sum + item.amount, 0),
      },
    });

    await createPurchasedProducts(tx, row, items);

    return row;
  });

  revalidateBillLookups();
  revalidatePath("/bill-details");
  revalidatePath("/customers");
  revalidatePath("/equipment");
  redirect(`/bill-details/${bill.id}`);
}

export async function addBillDetailItemFromForm(formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const billDetailId = requiredText(formData.get("billDetailId"), "Bill", 100);

  const result = await billTransaction(async (tx) => {
    await lockBill(tx, billDetailId);
    await assertBillEditable(tx, billDetailId);
    const bill = await tx.billDetail.findUnique({
      where: { id: billDetailId },
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        customerId: true,
      },
    });
    if (!bill) throw new Error("Bill detail not found.");

    const item = readBillItemInput(formData, bill.billDate);
    const currentQuantity = await tx.billDetailItem.aggregate({ where: { billDetailId: bill.id }, _sum: { amount: true } });
    const trackedCount = await tx.billDetailItemUnit.count({ where: { billDetailItem: { billDetailId: bill.id } } });
    if (trackedCount + trackedProductCount(item) > MAX_BILL_MACHINES) throw new Error(`A bill can contain at most ${MAX_BILL_MACHINES} tracked products (Unit machines or Kg groups).`);
    if (Number(currentQuantity._sum.amount ?? 0) + item.amount > 9999999999.99) throw new Error("Bill total is too large. Please check the prices and quantities.");
    const added = await createPurchasedProducts(tx, bill, [item]);

    await tx.billDetail.update({
      where: { id: bill.id },
      data: { total: { increment: item.amount } },
    });


    return {
      billId: bill.id,
      customerId: bill.customerId,
      equipmentId: added.equipmentIds[0],
      itemName: added.itemName,
    };
  });

  revalidateBillLookups();
  revalidatePath("/bill-details");
  revalidatePath(`/bill-details/${result.billId}`);
  revalidatePath(`/customers/${result.customerId}`);
  revalidatePath(`/equipment/${result.equipmentId}`);
  revalidatePath("/equipment");
  redirect(
    `/bill-details/${result.billId}?productAdded=${encodeURIComponent(
      result.itemName,
    )}`,
  );
}

export async function updateBillDetail(id: string, formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const billNumber = requiredText(
    formData.get("billNumber"),
    "Invoice No.",
    80,
  );
  const billDate = optionalDate(formData.get("billDate")) ?? new Date();
  const customerId = requiredText(formData.get("customerId"), "Customer", 100);

  const result = await billTransaction(async (tx) => {
    await lockBill(tx, id);
    await assertBillEditable(tx, id);
    const bill = await tx.billDetail.findUnique({
      where: { id },
      include: { items: { include: { equipment: true, units: true } } },
    });
    if (!bill) throw new Error("Bill detail not found.");

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found.");

    const existing = await tx.billDetail.findUnique({
      where: { billNumber },
      select: { id: true },
    });
    if (existing && existing.id !== bill.id) {
      throw new Error("This invoice number already exists.");
    }

    const equipmentIds = [...new Set(bill.items.flatMap(item => item.units.map(unit => unit.equipmentId)))];
    const customerChanged = customerId !== bill.customerId;

    if (customerChanged) {
      await assertMachinesUnused(tx, equipmentIds);
      if (await tx.billDetailItemUnit.count({ where: { equipmentId: { in: equipmentIds }, billDetailItem: { billDetailId: { not: bill.id } } } })) throw new Error("A machine is linked to another bill. Its customer cannot be changed here.");
    }

    await tx.billDetail.update({
      where: { id: bill.id },
      data: {
        billNumber,
        billDate,
        customerId,
      },
    });

    if (equipmentIds.length) {
      await tx.customerEquipment.updateMany({
        where: { id: { in: equipmentIds } },
        data: {
          invoiceNumber: billNumber,
          purchaseDate: billDate,
          ...(customerChanged ? { customerId } : {}),
        },
      });
    }

    return {
      billId: bill.id,
      oldCustomerId: bill.customerId,
      customerId,
      equipmentIds,
    };
  });

  revalidateBillLookups();
  revalidatePath("/bill-details");
  revalidatePath(`/bill-details/${result.billId}`);
  revalidatePath(`/bill-details/${result.billId}/edit`);
  revalidatePath(`/customers/${result.oldCustomerId}`);
  revalidatePath(`/customers/${result.customerId}`);
  for (const equipmentId of result.equipmentIds) {
    revalidatePath(`/equipment/${equipmentId}`);
  }
  revalidatePath("/equipment");
  redirect(`/bill-details/${result.billId}?billUpdated=1`);
}

export async function updateBillDetailItem(itemId: string, formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const result = await billTransaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemId}))`;
    const scope = await tx.billDetailItem.findUnique({ where: { id: itemId }, select: { billDetailId: true } });
    if (!scope) throw new Error("Bill product not found.");
    await lockBill(tx, scope.billDetailId);
    await assertBillEditable(tx, scope.billDetailId);
    const existingItem = await tx.billDetailItem.findUnique({
      where: { id: itemId },
      include: {
        billDetail: true,
        equipment: true,
        units: { include: { equipment: true }, orderBy: { unitNumber: "asc" } },
      },
    });
    if (!existingItem) throw new Error("Bill product not found.");

    const item = readBillItemInput(formData, existingItem.billDetail.billDate);

    const equipmentIds = await updatePurchasedProduct(tx, existingItem, item, formData.has("existingUnits") ? String(formData.get("existingUnits")) : null);

    const total = await tx.billDetailItem.aggregate({
      where: { billDetailId: existingItem.billDetailId },
      _sum: { amount: true },
    });
    if (await tx.billDetailItemUnit.count({ where: { billDetailItem: { billDetailId: existingItem.billDetailId } } }) > MAX_BILL_MACHINES) throw new Error(`A bill can contain at most ${MAX_BILL_MACHINES} tracked products (Unit machines or Kg groups).`);
    if (Number(total._sum.amount ?? 0) > 9999999999.99) throw new Error("Bill total is too large. Please check the prices and quantities.");
    await tx.billDetail.update({
      where: { id: existingItem.billDetailId },
      data: { total: total._sum.amount ?? 0 },
    });

    return {
      billId: existingItem.billDetailId,
      customerId: existingItem.billDetail.customerId,
      equipmentId: equipmentIds[0],
      equipmentIds,
      itemName: item.itemName,
    };
  });

  revalidateBillLookups();
  revalidatePath("/bill-details");
  revalidatePath(`/bill-details/${result.billId}`);
  revalidatePath(`/bill-details/${result.billId}/items/${itemId}/edit`);
  revalidatePath(`/customers/${result.customerId}`);
  revalidatePath(`/equipment/${result.equipmentId}`);
  for (const equipmentId of result.equipmentIds) revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  redirect(
    `/bill-details/${result.billId}?productUpdated=${encodeURIComponent(
      result.itemName,
    )}`,
  );
}

export async function createComplaintFromBillDetailFromForm(
  formData: FormData,
) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const billDetailId = requiredText(formData.get("billDetailId"), "Bill", 100);
  const equipmentId = requiredText(formData.get("equipmentId"), "Equipment", 100);
  const customerComplaint = requiredText(
    formData.get("customerComplaint"),
    "Problem details",
  );
  const priority = String(formData.get("priority") || "NORMAL");
  const source = String(formData.get("source") || "PHONE");
  const technicianId = optionalString(formData.get("technicianId"));
  if (!Object.values(ComplaintPriority).includes(priority as ComplaintPriority))
    throw new Error("Invalid complaint priority.");
  if (!Object.values(ComplaintSource).includes(source as ComplaintSource))
    throw new Error("Invalid complaint source.");
  if (
    technicianId &&
    user.role !== "ADMIN" &&
    !user.canAssignTechnician
  )
    throw new Error("You do not have technician assignment permission.");

  const complaint = await billTransaction(async (tx) => {
    await lockBill(tx, billDetailId);
    const bill = await tx.billDetail.findUnique({
      where: { id: billDetailId },
      include: { items: { include: { units: true } } },
    });
    if (!bill) throw new Error("Bill detail not found.");
    const item = bill.items.find((row) => row.units.some(unit => unit.equipmentId === equipmentId));
    if (!item)
      throw new Error("Selected equipment is not part of this bill detail.");

    const equipment = await tx.customerEquipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, customerId: true },
    });
    if (!equipment || equipment.customerId !== bill.customerId)
      throw new Error("Selected equipment does not belong to this customer.");

    let technicianName: string | null = null;
    if (technicianId) {
      const technician = await tx.technician.findUnique({
        where: { id: technicianId },
      });
      if (
        !technician ||
        !technician.isActive ||
        technician.status === TechnicianStatus.INACTIVE ||
        technician.status === TechnicianStatus.ON_LEAVE
      )
        throw new Error("Selected technician is not available.");
      technicianName = technician.name;
    }

    const { repeatIssueDetected, repeatReferenceServiceId } =
      await detectRepeatIssue(tx, equipmentId, customerComplaint);
    const complaintNumber = await nextDocumentNumber(
      tx,
      "complaint",
      "VFE-SRV-",
    );
    const row = await tx.serviceComplaint.create({
      data: {
        complaintNumber,
        complaintDate:
          optionalDate(formData.get("complaintDate")) ?? new Date(),
        customerId: bill.customerId,
        equipmentId,
        customerComplaint,
        complaintCategory: optionalString(formData.get("complaintCategory")),
        priority: priority as ComplaintPriority,
        preferredVisitDate: optionalDate(formData.get("preferredVisitDate")),
        notes: optionalString(formData.get("notes")),
        source: source as ComplaintSource,
        status: technicianId
          ? ServiceStatus.TECHNICIAN_ASSIGNED
          : ServiceStatus.UNASSIGNED,
        currentTechnicianId: technicianId,
        createdById: user.id,
        repeatIssueDetected,
        repeatReferenceServiceId,
      },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId: row.id,
        previousStatus: ServiceStatus.COMPLAINT_RECEIVED,
        newStatus: row.status,
        changedById: user.id,
        notes: technicianId
          ? "Complaint registered from bill details and technician assigned."
          : "Complaint registered from bill details.",
      },
    });
    if (technicianId) {
      await tx.serviceAssignment.create({
        data: {
          complaintId: row.id,
          technicianId,
          assignedById: user.id,
          reason: "Assigned during bill-detail complaint entry.",
        },
      });
      await tx.technician.update({
        where: { id: technicianId },
        data: { status: TechnicianStatus.BUSY },
      });
    }
    return row;
  });

  revalidatePath(`/bill-details/${billDetailId}`);
  revalidatePath("/bill-details");
  revalidatePath("/complaints");
  revalidatePath("/teams");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  redirect(`/complaints/${complaint.id}`);
}

export async function updateCompleteBill(id: string, formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const billNumber = requiredText(formData.get("billNumber"), "Invoice No.", 80);
  const billDate = optionalDate(requiredText(formData.get("billDate"), "Purchase date"))!;
  const products = readBillItemInputs(formData, billDate);
  const type = requiredText(formData.get("newCustomerType"), "Customer type", 50);
  if (!Object.values(CustomerType).includes(type as CustomerType)) throw new Error("Invalid customer type.");
  const result = await billTransaction(tx => saveBillEditor(tx, id, {
    billNumber, billDate,
    expectedBillVersion: requiredText(formData.get("billVersion"), "Bill version"),
    expectedCustomerVersion: requiredText(formData.get("customerVersion"), "Customer version"),
    customer: {
      type: type as CustomerType,
      name: requiredText(formData.get("newCustomerName"), "Customer name", 200),
      primaryMobile: phoneNumber(formData.get("newCustomerPrimaryMobile"), "Primary mobile")!,
      alternateMobile: phoneNumber(formData.get("newCustomerAlternateMobile"), "Alternate mobile", false), email: optionalString(formData.get("newCustomerEmail")),
      address: requiredText(formData.get("newCustomerAddress"), "Address", 1000), city: requiredText(formData.get("newCustomerCity"), "City", 120),
      state: requiredText(formData.get("newCustomerState"), "State", 120), pinCode: indianPinCode(formData.get("newCustomerPinCode")),
      gstNumber: optionalString(formData.get("newCustomerGstNumber")),
    },
    products: products.map((data, index) => ({ data, itemId: optionalString(formData.get(`items.${index}.itemId`)), expectedUnits: optionalString(formData.get(`items.${index}.existingUnits`)) })),
  }));
  revalidateBillLookups();
  for (const path of ["/bill-details", `/bill-details/${id}`, "/customers", `/customers/${result.customerId}`, "/equipment", "/dashboard"]) revalidatePath(path);
  for (const equipmentId of result.equipmentIds) revalidatePath(`/equipment/${equipmentId}`);
  redirect(`/bill-details/${id}?billUpdated=1`);
}

export async function deleteBillDetailFromForm(formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const billDetailId = requiredText(formData.get("billDetailId"), "Bill", 100);

  let deleteBlocked = false;
  const result = await billTransaction(async (tx) => {
      await lockBill(tx, billDetailId);
      const bill = await tx.billDetail.findUnique({
        where: { id: billDetailId },
        include: { items: { include: { equipment: true, units: true } } },
      });
      if (!bill) throw new Error("Bill detail not found.");

      const equipmentIdsToDelete = [...new Set(bill.items.flatMap(item => item.units.map(unit => unit.equipmentId)))];
      await assertMachinesUnused(tx, equipmentIdsToDelete);
      await tx.billDetail.delete({ where: { id: bill.id } });
      await deleteUnusedBillMachines(tx, equipmentIdsToDelete, bill.billNumber);
      const customerDeleted = await deleteCustomerIfOrphaned(
        tx,
        bill.customerId,
      );
      return { customerId: bill.customerId, customerDeleted };
    })
    .catch((error) => {
      if (isProtectedDeleteError(error)) {
        deleteBlocked = true;
        return null;
      }
      throw error;
    });

  if (deleteBlocked) {
    redirect("/bill-details?deleteBlocked=1");
  }

  revalidateBillLookups();
  revalidatePath("/bill-details");
  revalidatePath("/customers");
  if (result?.customerId) revalidatePath(`/customers/${result.customerId}`);
  revalidatePath("/equipment");
  redirect(
    `/bill-details?deleted=1${
      result?.customerDeleted ? "&customerDeleted=1" : ""
    }`,
  );
}

export async function deleteBillDetailItemFromForm(formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const itemId = requiredText(formData.get("itemId"), "Bill item", 100);

  let blockedBillId: string | null = null;
  const result = await billTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemId}))`;
      const scope = await tx.billDetailItem.findUnique({ where: { id: itemId }, select: { billDetailId: true } });
      if (!scope) throw new Error("Bill product not found.");
      await lockBill(tx, scope.billDetailId);
      const item = await tx.billDetailItem.findUnique({
        where: { id: itemId },
        include: { billDetail: true, equipment: true, units: true },
      });
      if (!item) throw new Error("Bill item not found.");

      const equipmentIds = item.units.map(unit => unit.equipmentId);
      await assertMachinesUnused(tx, equipmentIds);
      await tx.billDetailItem.delete({ where: { id: item.id } });
      await tx.billDetail.update({
        where: { id: item.billDetailId },
        data: { total: { decrement: item.amount } },
      });
      await deleteUnusedBillMachines(tx, equipmentIds, item.billDetail.billNumber);
      return {
        billId: item.billDetailId,
        customerId: item.billDetail.customerId,
        equipmentId: item.equipmentId,
        equipmentIds,
      };
    })
    .catch(async (error) => {
      if (isProtectedDeleteError(error)) {
        const item = await db.billDetailItem.findUnique({
          where: { id: itemId },
          select: { billDetailId: true },
        });
        blockedBillId = item?.billDetailId ?? null;
        return null;
      }
      throw error;
    });

  if (blockedBillId) {
    redirect(`/bill-details/${blockedBillId}?deleteBlocked=1`);
  }
  if (!result) {
    redirect("/bill-details?deleteBlocked=1");
  }

  revalidateBillLookups();
  revalidatePath(`/bill-details/${result.billId}`);
  revalidatePath("/bill-details");
  revalidatePath(`/customers/${result.customerId}`);
  if (result.equipmentId) revalidatePath(`/equipment/${result.equipmentId}`);
  for (const equipmentId of result.equipmentIds) revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  redirect(`/bill-details/${result.billId}?productDeleted=1`);
}

async function resolveCustomer(
  tx: Prisma.TransactionClient,
  userId: string,
  formData: FormData,
) {
  const customerMode = String(formData.get("customerMode") || "existing");
  if (customerMode === "new") {
    const type = requiredText(
      formData.get("newCustomerType"),
      "Customer type",
      50,
    );
    if (!Object.values(CustomerType).includes(type as CustomerType))
      throw new Error("Invalid customer type.");
    const pinCode = indianPinCode(formData.get("newCustomerPinCode"));

    const customerCode = await nextDocumentNumber(tx, "customer", "VFE-CUS-");
    const customer = await tx.customer.create({
      data: {
        customerCode,
        type: type as CustomerType,
        name: requiredText(formData.get("newCustomerName"), "Customer name"),
        primaryMobile: phoneNumber(
          formData.get("newCustomerPrimaryMobile"),
          "Primary mobile",
        )!,
        alternateMobile: phoneNumber(
          formData.get("newCustomerAlternateMobile"),
          "Alternate mobile",
          false,
        ),
        email: optionalString(formData.get("newCustomerEmail")),
        address: requiredText(formData.get("newCustomerAddress"), "Address"),
        city: requiredText(formData.get("newCustomerCity"), "City", 120),
        state: requiredText(formData.get("newCustomerState"), "State", 120),
        pinCode,
        gstNumber: optionalString(formData.get("newCustomerGstNumber")),
      },
    });
    return customer.id;
  }

  const customerId = String(formData.get("customerId") ?? "").trim();
  if (!customerId) throw new Error("Customer is required.");
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found.");
  return customer.id;
}

async function detectRepeatIssue(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  customerComplaint: string,
) {
  const history = await tx.serviceRecord.findMany({
    where: { equipmentId },
    orderBy: { serviceDate: "desc" },
    take: 10,
  });
  let best = 0;
  let repeatReferenceServiceId: string | null = null;
  for (const row of history) {
    const score = Math.max(
      similarity(customerComplaint, row.complaintReported),
      similarity(customerComplaint, row.problemFound),
    );
    if (score > best) {
      best = score;
      repeatReferenceServiceId = row.id;
    }
  }
  const repeatIssueDetected = best >= 0.34;
  return {
    repeatIssueDetected,
    repeatReferenceServiceId: repeatIssueDetected
      ? repeatReferenceServiceId
      : null,
  };
}

async function deleteCustomerIfOrphaned(
  tx: Prisma.TransactionClient,
  customerId: string,
) {
  const [
    billDetails,
    equipment,
    complaints,
    serviceRecords,
    serviceCollections,
  ] = await Promise.all([
    tx.billDetail.count({ where: { customerId } }),
    tx.customerEquipment.count({ where: { customerId } }),
    tx.serviceComplaint.count({ where: { customerId } }),
    tx.serviceRecord.count({ where: { customerId } }),
    tx.serviceCollection.count({ where: { customerId } }),
  ]);

  if (
    billDetails ||
    equipment ||
    complaints ||
    serviceRecords ||
    serviceCollections
  ) {
    return false;
  }

  await tx.customer.delete({ where: { id: customerId } });
  return true;
}

function readBillItemInputs(formData: FormData, billDate: Date) {
  const productCount = formData.has("productCount") ? Number(formData.get("productCount")) : 0;
  if (!Number.isSafeInteger(productCount) || productCount < 0 || productCount > 50) throw new Error("A bill must contain between 1 and 50 product lines.");
  const items = productCount ? Array.from({ length: productCount }, (_, index) => readBillItemInput(formData, billDate, `items.${index}.`)) : [readBillItemInput(formData, billDate)];
  if (items.reduce((total, item) => total + trackedProductCount(item), 0) > MAX_BILL_MACHINES) throw new Error(`A bill can contain at most ${MAX_BILL_MACHINES} tracked products (Unit machines or Kg groups).`);
  if (items.reduce((total, item) => total + item.amount, 0) > 9999999999.99) throw new Error("Bill total is too large. Please check the prices and quantities.");
  validateMachineSerials(items.flatMap(item => item.serialNumbers));
  return items;
}

function readBillItemInput(
  formData: FormData,
  billDate: Date,
  prefix = "",
): BillItemInput {
  const quantityUnit = readQuantityUnit(formData.get(`${prefix}quantityUnit`));
  const quantity = productQuantity(formData.get(`${prefix}quantity`), quantityUnit);
  const unitPrice = positiveNumber(
    formData.get(`${prefix}unitPrice`),
    "Unit price",
  );
  const amount = Number((quantity * unitPrice).toFixed(2));
  if (amount > 9999999999.99) throw new Error("Product amount is too large. Please check the unit price and quantity.");
  const serialNumbers = quantityUnit === "KG" ? [] : Array.from({ length: quantity }, (_, index) => {
    const key = index === 0 ? `${prefix}serialNumber` : `${prefix}unitSerialNumbers.${index}`;
    return formData.has(key) ? optionalString(formData.get(key)) : undefined;
  });
  validateMachineSerials(serialNumbers);
  const warranty = readWarranty(formData, billDate, prefix);

  return {
    itemName: requiredText(
      formData.get(`${prefix}itemName`),
      "Equipment / item name",
    ),
    brand: requiredText(formData.get(`${prefix}brand`), "Brand", 120),
    modelNumber: optionalString(formData.get(`${prefix}modelNumber`)),
    serialNumber: serialNumbers[0] ?? null,
    serialNumbers,
    installationDate: optionalDate(formData.get(`${prefix}installationDate`)),
    quantity,
    quantityUnit,
    unitPrice,
    amount,
    warrantyStartDate: warranty.startDate,
    warrantyExpiryDate: warranty.expiryDate,
    warrantyDuration: warranty.duration,
    notes: optionalString(formData.get(`${prefix}itemNotes`)),
  };
}

function readWarranty(formData: FormData, billDate: Date, prefix = "") {
  const explicitStart = optionalDate(formData.get(`${prefix}warrantyStartDate`));
  const explicitExpiry = optionalDate(
    formData.get(`${prefix}warrantyExpiryDate`),
  );
  const explicitDuration = optionalString(
    formData.get(`${prefix}warrantyDuration`),
  );
  const warrantyApplicable =
    formData.get(`${prefix}warrantyApplicable`) === "on";

  if (!warrantyApplicable) {
    return {
      startDate: null,
      expiryDate: null,
      duration: null,
    };
  }

  const months = Math.max(
    1,
    Math.trunc(n(formData.get(`${prefix}warrantyMonths`)) || 12),
  );
  const startDate = explicitStart ?? billDate;
  const expiryDate = explicitExpiry ?? addMonths(startDate, months);
  if (expiryDate < startDate) throw new Error("Warranty expiry must be on or after its start date.");
  return {
    startDate,
    expiryDate,
    duration: explicitDuration ?? `${months} Months`,
  };
}

function positiveNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(requiredText(value, label));
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${label} must be greater than zero.`);
  if (Number(parsed.toFixed(2)) !== parsed) throw new Error(`${label} must have no more than two decimal places.`);
  return parsed;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}
