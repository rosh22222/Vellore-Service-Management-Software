"use server";

import { PaymentMode, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRoles, requireUser } from "@/lib/auth";
import {
  nonNegativeNumber,
  optionalDate,
  optionalString,
  requiredText,
} from "@/lib/format";
import { nextDocumentNumber } from "@/lib/ids";

function revalidateCollectionPaths(serviceRecordId?: string) {
  revalidatePath("/service-collections");
  revalidatePath("/service-history");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  if (serviceRecordId) revalidatePath(`/service-history/${serviceRecordId}`);
}

function assertPaymentMode(value: string) {
  if (!Object.values(PaymentMode).includes(value as PaymentMode)) {
    throw new Error("Invalid payment mode.");
  }
  return value as PaymentMode;
}

export async function createServiceCollection(formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const serviceRecordId = requiredText(
    formData.get("serviceRecordId"),
    "Service record",
  );
  const amount = nonNegativeNumber(
    requiredText(formData.get("amount"), "Collection amount"),
    "Collection amount",
  );
  if (amount <= 0) throw new Error("Collection amount must be greater than 0.");

  const paymentMode = assertPaymentMode(
    String(formData.get("paymentMode") || PaymentMode.CASH),
  );
  const collectedAt = optionalDate(formData.get("collectedAt")) ?? new Date();
  const collectedById =
    optionalString(formData.get("collectedById")) ?? user.id;
  const receivedFrom = optionalString(formData.get("receivedFrom"));
  const notes = optionalString(formData.get("notes"));

  await db.$transaction(async (tx) => {
    // Serialize payments for this service before reading its current balance.
    await tx.$queryRaw`SELECT id FROM "ServiceRecord" WHERE id = ${serviceRecordId} FOR UPDATE`;
    const service = await tx.serviceRecord.findUnique({
      where: { id: serviceRecordId },
      include: { collections: true },
    });
    if (!service) throw new Error("Service record not found.");

    const collector = await tx.user.findUnique({
      where: { id: collectedById },
      select: { id: true, isActive: true, role: true },
    });
    if (!collector?.isActive) throw new Error("Collected-by user is invalid.");
    if (
      ![UserRole.ADMIN, UserRole.OFFICE_STAFF, UserRole.TECHNICIAN].includes(
        collector.role,
      )
    ) {
      throw new Error("Collected-by user is invalid.");
    }

    const total = Number(service.charges);
    const alreadyCollected = service.collections.reduce(
      (sum, collection) => sum + Number(collection.amount),
      0,
    );
    const balance = Math.max(0, total - alreadyCollected);
    if (amount > balance + 0.001) {
      throw new Error(
        `Collection amount cannot be more than pending balance (${balance.toFixed(2)}).`,
      );
    }

    const collectionNumber = await nextDocumentNumber(
      tx,
      "service_collection",
      "VFE-COL-",
    );
    await tx.serviceCollection.create({
      data: {
        collectionNumber,
        serviceRecordId: service.id,
        complaintId: service.complaintId,
        customerId: service.customerId,
        equipmentId: service.equipmentId,
        technicianId: service.technicianId,
        collectedById,
        amount,
        paymentMode,
        collectedAt,
        receivedFrom,
        notes,
      },
    });
  });

  revalidateCollectionPaths(serviceRecordId);
}

export async function deleteServiceCollection(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    throw new Error("Only Admin can delete a collection entry.");
  }
  const id = requiredText(formData.get("id"), "Collection");
  const deleted = await db.serviceCollection.delete({
    where: { id },
    select: { serviceRecordId: true },
  });
  revalidateCollectionPaths(deleted.serviceRecordId);
}
