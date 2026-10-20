"use server";
import { lockEquipmentBills } from "@/lib/bill-edit";

import {
  ComplaintPriority,
  ComplaintSource,
  CustomerType,
  EquipmentStatus,
  PaymentMode,
  Prisma,
  ServiceStatus,
  TechnicianStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/ids";
import {
  n,
  nonNegativeNumber,
  optionalDate,
  optionalString,
  requiredText,
} from "@/lib/format";
import { similarity } from "@/lib/similarity";
import { warrantyStatus } from "@/lib/warranty";

function revalidateOperationalLookups() {
  revalidateTag("customer-options");
  revalidateTag("equipment-options");
  revalidateTag("technician-options");
}

async function requireComplaintAccess(complaintId: string) {
  const user = await requireUser();
  const complaint = await db.serviceComplaint.findUnique({
    where: { id: complaintId },
    include: { serviceRecord: true },
  });
  if (!complaint) throw new Error("Complaint not found.");
  if (complaint.status === ServiceStatus.CANCELLED || complaint.status === ServiceStatus.CLOSED)
    throw new Error("This complaint is closed or cancelled and cannot be changed.");
  if (
    user.role === UserRole.TECHNICIAN &&
    complaint.currentTechnicianId !== user.technicianId
  )
    throw new Error("You are not assigned to this job.");
  return { user, complaint };
}

function canAssign(user: Awaited<ReturnType<typeof requireUser>>) {
  return (
    user.role === UserRole.ADMIN ||
    (user.role === UserRole.OFFICE_STAFF && user.canAssignTechnician)
  );
}

async function detectRepeatIssue(
  tx: Prisma.TransactionClient,
  equipmentId: string | null,
  customerComplaint: string,
) {
  if (!equipmentId) {
    return { repeatIssueDetected: false, repeatReferenceServiceId: null };
  }
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

const terminalStatuses: ServiceStatus[] = [
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];
const technicianStatuses = new Set<ServiceStatus>([
  ServiceStatus.TECHNICIAN_ACCEPTED,
  ServiceStatus.TECHNICIAN_VISITING,
  ServiceStatus.INSPECTION_STARTED,
  ServiceStatus.PROBLEM_DIAGNOSED,
  ServiceStatus.REPAIR_IN_PROGRESS,
  ServiceStatus.WAITING_FOR_SPARE_PART,
  ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL,
]);

export async function createComplaint(formData: FormData) {
  const user = await requireUser();
  if (user.role === UserRole.TECHNICIAN)
    throw new Error("Technicians cannot register office complaints.");
  const customerMode = String(formData.get("customerMode") || "existing");
  const equipmentMode = String(formData.get("equipmentMode") || "existing");
  if (!["existing", "unknown"].includes(equipmentMode)) throw new Error("Choose existing equipment or Not Known. Add new products through Bill Details or Equipment.");
  const technicianId = optionalString(formData.get("technicianId"));
  if (technicianId && !canAssign(user)) throw new Error("You do not have technician assignment permission.");
  const customerComplaint = requiredText(
    formData.get("customerComplaint"),
    "Customer complaint",
  );
  const priority = String(formData.get("priority") || "NORMAL");
  const source = String(formData.get("source") || "PHONE");
  if (!Object.values(ComplaintPriority).includes(priority as ComplaintPriority))
    throw new Error("Invalid complaint priority.");
  if (!Object.values(ComplaintSource).includes(source as ComplaintSource))
    throw new Error("Invalid complaint source.");

  const complaint = await db.$transaction(async (tx) => {
    let customerId = String(formData.get("customerId") ?? "");
    if (customerMode === "new") {
      const type = requiredText(
        formData.get("newCustomerType"),
        "Customer type",
        50,
      );
      if (!Object.values(CustomerType).includes(type as CustomerType))
        throw new Error("Invalid customer type.");
      const pinCode = requiredText(
        formData.get("newCustomerPinCode"),
        "PIN Code",
        20,
      );
      const customerCode = await nextDocumentNumber(
        tx,
        "customer",
        "VFE-CUS-",
      );
      const customer = await tx.customer.create({
        data: {
          customerCode,
          type: type as CustomerType,
          name: requiredText(
            formData.get("newCustomerName"),
            "Customer name",
            200,
          ),
          primaryMobile: requiredText(
            formData.get("newCustomerPrimaryMobile"),
            "Primary mobile",
            30,
          ),
          alternateMobile: optionalString(
            formData.get("newCustomerAlternateMobile"),
          ),
          email: optionalString(formData.get("newCustomerEmail")),
          address: requiredText(
            formData.get("newCustomerAddress"),
            "Address",
            1000,
          ),
          city: requiredText(formData.get("newCustomerCity"), "City", 120),
          state: requiredText(formData.get("newCustomerState"), "State", 120),
          pinCode,
          gstNumber: optionalString(formData.get("newCustomerGstNumber")),
          notes: optionalString(formData.get("newCustomerNotes")),
        },
      });
      customerId = customer.id;
    } else {
      if (!customerId) throw new Error("Customer is required.");
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customer) throw new Error("Customer not found.");
    }

    let equipmentId: string | null = null;
    if (equipmentMode === "existing") {
      if (customerMode === "new")
        throw new Error("A new customer cannot use existing equipment.");
      equipmentId = requiredText(formData.get("equipmentId"), "Equipment");
      if (equipmentId) {
        await lockEquipmentBills(tx, equipmentId);
        const equipment = await tx.customerEquipment.findUnique({
          where: { id: equipmentId },
          select: { customerId: true },
        });
        if (!equipment || equipment.customerId !== customerId)
          throw new Error(
            "The selected equipment does not belong to this customer.",
          );
      }
    } else if (equipmentMode !== "unknown") {
      throw new Error("Invalid equipment option.");
    }

    if (technicianId) {
      const technician = await tx.technician.findUnique({ where: { id: technicianId }, select: { isActive: true, status: true } });
      if (!technician?.isActive || technician.status === TechnicianStatus.INACTIVE || technician.status === TechnicianStatus.ON_LEAVE) throw new Error("Selected technician is not available.");
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
        customerId,
        equipmentId,
        customerComplaint,
        complaintCategory: optionalString(formData.get("complaintCategory")),
        priority: priority as ComplaintPriority,
        preferredVisitDate: optionalDate(formData.get("preferredVisitDate")),
        notes: optionalString(formData.get("notes")),
        source: source as ComplaintSource,
        status: technicianId ? ServiceStatus.TECHNICIAN_ASSIGNED : ServiceStatus.UNASSIGNED,
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
        notes: "Complaint registered.",
      },
    });
    if (technicianId) {
      await tx.serviceAssignment.create({ data: { complaintId: row.id, technicianId, assignedById: user.id, reason: "Assigned during complaint registration." } });
      await tx.technician.update({ where: { id: technicianId }, data: { status: TechnicianStatus.BUSY } });
    }
    return row;
  });
  revalidateOperationalLookups();
  revalidatePath("/customers");
  revalidatePath("/equipment");
  revalidatePath("/complaints");
  revalidatePath("/teams");
  revalidatePath("/dashboard");
  redirect(`/complaints/${complaint.id}`);
}

export async function linkComplaintEquipmentFromForm(formData: FormData) {
  const user = await requireUser();
  if (user.role === UserRole.TECHNICIAN)
    throw new Error("Technicians cannot change complaint master data.");
  const complaintId = String(formData.get("complaintId") ?? "").trim();
  const equipmentMode = String(formData.get("equipmentMode") || "existing");
  if (!complaintId) throw new Error("Complaint is required.");

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: { serviceRecord: true },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (complaint.serviceRecord)
      throw new Error("Completed service records are immutable.");

    let equipmentId: string | null = null;
    if (equipmentMode === "existing") {
      equipmentId = optionalString(formData.get("equipmentId"));
      if (!equipmentId) throw new Error("Equipment is required.");
      await lockEquipmentBills(tx, equipmentId);
      const equipment = await tx.customerEquipment.findUnique({
        where: { id: equipmentId },
        select: { customerId: true },
      });
      if (!equipment || equipment.customerId !== complaint.customerId)
        throw new Error(
          "The selected equipment does not belong to this customer.",
        );
    } else if (equipmentMode === "new") {
      const serialNumber = optionalString(formData.get("newEquipmentSerial"));
      if (serialNumber) {
        const existingSerial = await tx.customerEquipment.findUnique({
          where: { serialNumber },
          select: { id: true },
        });
        if (existingSerial)
          throw new Error("This equipment serial number is already registered.");
      }
      const equipmentCode = await nextDocumentNumber(
        tx,
        "equipment",
        "VFE-EQP-",
      );
      const equipment = await tx.customerEquipment.create({
        data: {
          equipmentCode,
          customerId: complaint.customerId,
          name: requiredText(
            formData.get("newEquipmentName"),
            "Equipment name",
            200,
          ),
          brand: optionalString(formData.get("newEquipmentBrand")),
          modelNumber: optionalString(formData.get("newEquipmentModel")),
          serialNumber,
          purchaseDate: optionalDate(formData.get("newEquipmentPurchaseDate")),
          invoiceNumber: optionalString(formData.get("newEquipmentInvoice")),
          installationDate: optionalDate(
            formData.get("newEquipmentInstallationDate"),
          ),
          warrantyStartDate: optionalDate(
            formData.get("newEquipmentWarrantyStartDate"),
          ),
          warrantyExpiryDate: optionalDate(
            formData.get("newEquipmentWarrantyExpiryDate"),
          ),
          warrantyDuration: optionalString(
            formData.get("newEquipmentWarrantyDuration"),
          ),
          status: EquipmentStatus.ACTIVE,
          notes: optionalString(formData.get("newEquipmentNotes")),
        },
      });
      equipmentId = equipment.id;
    } else if (equipmentMode !== "unknown") {
      throw new Error("Invalid equipment option.");
    }

    const { repeatIssueDetected, repeatReferenceServiceId } =
      await detectRepeatIssue(tx, equipmentId, complaint.customerComplaint);
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { equipmentId, repeatIssueDetected, repeatReferenceServiceId },
    });
    return {
      customerId: complaint.customerId,
      equipmentId,
      repeatReferenceServiceId,
    };
  });

  revalidateOperationalLookups();
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/jobs/${complaintId}`);
  revalidatePath(`/customers/${result.customerId}`);
  if (result.equipmentId) revalidatePath(`/equipment/${result.equipmentId}`);
  if (result.repeatReferenceServiceId)
    revalidatePath(`/service-history/${result.repeatReferenceServiceId}`);
  revalidatePath("/equipment");
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  revalidatePath("/teams");
}

export async function assignTechnician(
  complaintId: string,
  technicianId: string,
  reason?: string,
) {
  const user = await requireUser();
  if (!canAssign(user))
    throw new Error("You do not have technician assignment permission.");
  await db.$transaction(async (tx) => {
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (terminalStatuses.includes(complaint.status))
      throw new Error("Completed/closed complaints cannot be assigned.");
    const tech = await tx.technician.findUnique({
      where: { id: technicianId },
    });
    if (
      !tech ||
      !tech.isActive ||
      tech.status === TechnicianStatus.INACTIVE ||
      tech.status === TechnicianStatus.ON_LEAVE
    )
      throw new Error("Selected technician is not available for assignment.");

    const previousTechId = complaint.currentTechnicianId;
    if (previousTechId === technicianId)
      throw new Error("This technician is already assigned to the complaint.");
    if (previousTechId && !reason?.trim())
      throw new Error("A reassignment reason is required.");
    if (previousTechId) {
      await tx.serviceAssignment.updateMany({
        where: { complaintId, isActive: true },
        data: {
          isActive: false,
          unassignedAt: new Date(),
          endedReason: reason || "Reassigned",
        },
      });
    }
    await tx.serviceAssignment.create({
      data: {
        complaintId,
        technicianId,
        assignedById: user.id,
        reason:
          reason ||
          (previousTechId ? "Reassigned by office" : "Initial assignment"),
      },
    });
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: {
        currentTechnicianId: technicianId,
        status: ServiceStatus.TECHNICIAN_ASSIGNED,
      },
    });
    await tx.technician.update({
      where: { id: technicianId },
      data: { status: TechnicianStatus.BUSY },
    });
    if (previousTechId) {
      const previousOpenJobs = await tx.serviceComplaint.count({
        where: {
          currentTechnicianId: previousTechId,
          id: { not: complaintId },
          status: { notIn: terminalStatuses },
        },
      });
      await tx.technician.update({
        where: { id: previousTechId },
        data: {
          status: previousOpenJobs
            ? TechnicianStatus.BUSY
            : TechnicianStatus.AVAILABLE,
        },
      });
    }
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: complaint.status,
        newStatus: ServiceStatus.TECHNICIAN_ASSIGNED,
        changedById: user.id,
        notes: previousTechId
          ? `Reassigned technician. ${reason ?? ""}`
          : "Technician assigned.",
      },
    });
  });
  revalidatePath("/teams");
  revalidatePath("/complaints");
  revalidateOperationalLookups();
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
}

export async function assignTechnicianFromForm(formData: FormData) {
  const complaintId = requiredText(formData.get("complaintId"), "Complaint");
  const technicianId = requiredText(formData.get("technicianId"), "Technician");
  const reason = optionalString(formData.get("reason")) ?? undefined;
  return assignTechnician(complaintId, technicianId, reason);
}

export async function updateServiceStatus(
  complaintId: string,
  formData: FormData,
) {
  const { user, complaint } = await requireComplaintAccess(complaintId);
  if (complaint.serviceRecord)
    throw new Error("Completed service records are immutable.");
  const newStatus = String(formData.get("status")) as ServiceStatus;
  const notes = optionalString(formData.get("notes"));
  if (!Object.values(ServiceStatus).includes(newStatus))
    throw new Error("Invalid status.");
  if (terminalStatuses.includes(complaint.status))
    throw new Error(
      "Completed, closed or cancelled complaints cannot be changed.",
    );
  if (user.role === UserRole.TECHNICIAN && !technicianStatuses.has(newStatus))
    throw new Error("Technicians cannot select that status.");
  if (
    newStatus !== ServiceStatus.UNASSIGNED &&
    newStatus !== ServiceStatus.CANCELLED &&
    newStatus !== ServiceStatus.CLOSED &&
    !complaint.currentTechnicianId
  )
    throw new Error(
      "Assign a technician before moving this complaint to that status.",
    );
  if (
    complaint.status === ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL &&
    user.role === UserRole.TECHNICIAN &&
    newStatus !== ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL
  )
    throw new Error(
      "Customer approval is pending. Office/Admin must update this status first.",
    );
  if (newStatus === ServiceStatus.SERVICE_COMPLETED)
    throw new Error(
      "Use Complete Service so mandatory details are validated and permanent history is created.",
    );
  if (
    (newStatus === ServiceStatus.CLOSED ||
      newStatus === ServiceStatus.CANCELLED) &&
    user.role === UserRole.TECHNICIAN
  )
    throw new Error("Only office/admin can close or cancel a complaint.");

  await db.$transaction(async (tx) => {
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: {
        status: newStatus,
        closedAt: newStatus === ServiceStatus.CLOSED ? new Date() : null,
        ...(newStatus === ServiceStatus.UNASSIGNED
          ? { currentTechnicianId: null }
          : {}),
      },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: complaint.status,
        newStatus,
        changedById: user.id,
        notes,
      },
    });
    if (
      (newStatus === ServiceStatus.UNASSIGNED ||
        newStatus === ServiceStatus.CLOSED ||
        newStatus === ServiceStatus.CANCELLED) &&
      complaint.currentTechnicianId
    ) {
      await tx.serviceAssignment.updateMany({
        where: { complaintId, isActive: true },
        data: {
          isActive: false,
          unassignedAt: new Date(),
          endedReason: notes ?? titleCaseStatus(newStatus),
        },
      });
      const openJobs = await tx.serviceComplaint.count({
        where: {
          currentTechnicianId: complaint.currentTechnicianId,
          id: { not: complaintId },
          status: { notIn: terminalStatuses },
        },
      });
      await tx.technician.update({
        where: { id: complaint.currentTechnicianId },
        data: {
          status: openJobs ? TechnicianStatus.BUSY : TechnicianStatus.AVAILABLE,
        },
      });
    }
  });
  revalidateOperationalLookups();
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/complaints");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

export async function saveInspection(complaintId: string, formData: FormData) {
  const { user, complaint } = await requireComplaintAccess(complaintId);
  if (complaint.serviceRecord)
    throw new Error("Completed service records are immutable.");
  if (!complaint.currentTechnicianId)
    throw new Error("Assign a technician before recording an inspection.");
  const findings = String(formData.get("findings") ?? "").trim();
  const actualProblem = String(formData.get("actualProblem") ?? "").trim();
  if (!findings || !actualProblem)
    throw new Error("Inspection findings and actual problem are required.");
  await db.$transaction(async (tx) => {
    await tx.serviceInspection.upsert({
      where: { complaintId },
      create: {
        complaintId,
        findings,
        actualProblem,
        technicianNotes: optionalString(formData.get("technicianNotes")),
      },
      update: {
        findings,
        actualProblem,
        technicianNotes: optionalString(formData.get("technicianNotes")),
      },
    });
    const oldStatus = complaint.status;
    const nextStatus = ServiceStatus.PROBLEM_DIAGNOSED;
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { status: nextStatus },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: oldStatus,
        newStatus: nextStatus,
        changedById: user.id,
        notes: "Inspection saved and problem diagnosed.",
      },
    });
  });
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/jobs/${complaintId}`);
  revalidatePath("/jobs");
}

export async function addWorkLog(complaintId: string, formData: FormData) {
  const { user, complaint } = await requireComplaintAccess(complaintId);
  if (complaint.serviceRecord)
    throw new Error("Completed service records are immutable.");
  if (!complaint.currentTechnicianId)
    throw new Error("Assign a technician before recording service work.");
  const workDone = String(formData.get("workDone") ?? "").trim();
  if (!workDone) throw new Error("Work done is required.");
  await db.$transaction(async (tx) => {
    await tx.serviceWorkLog.create({
      data: {
        complaintId,
        workDone,
        notes: optionalString(formData.get("notes")),
        createdById: user.id,
      },
    });
    if (complaint.status !== ServiceStatus.REPAIR_IN_PROGRESS) {
      await tx.serviceComplaint.update({
        where: { id: complaintId },
        data: { status: ServiceStatus.REPAIR_IN_PROGRESS },
      });
      await tx.serviceStatusHistory.create({
        data: {
          complaintId,
          previousStatus: complaint.status,
          newStatus: ServiceStatus.REPAIR_IN_PROGRESS,
          changedById: user.id,
          notes: "Service work recorded.",
        },
      });
    }
  });
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/jobs/${complaintId}`);
}

export async function addServicePart(complaintId: string, formData: FormData) {
  const { user, complaint } = await requireComplaintAccess(complaintId);
  if (complaint.serviceRecord)
    throw new Error("Completed service records are immutable.");
  const qty = n(formData.get("quantity"));
  if (qty <= 0) throw new Error("Quantity must be greater than zero.");

  await db.$transaction(async (tx) => {
    const partName = optionalString(formData.get("partName"));
    if (!partName) throw new Error("Part name is required.");
    const enteredPrice = nonNegativeNumber(
      formData.get("unitPrice"),
      "Unit price",
    );
    const unitPrice = enteredPrice;
    const amount = qty * unitPrice;
    await tx.servicePart.create({
      data: {
        complaintId,
        partName,
        partCode: optionalString(formData.get("partCode")),
        quantity: qty,
        unitPrice,
        amount,
        warrantyApplicable: formData.get("warrantyApplicable") === "on",
        oldPartReturned: formData.get("oldPartReturned") === "on",
        remarks: optionalString(formData.get("remarks")),
      },
    });
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { noPartsUsed: false },
    });
  });
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/jobs/${complaintId}`);
}

export async function markNoPartsUsed(complaintId: string) {
  const { user, complaint } = await requireComplaintAccess(complaintId);
  if (complaint.serviceRecord)
    throw new Error("Completed service records are immutable.");
  const parts = await db.servicePart.count({ where: { complaintId } });
  if (parts > 0) throw new Error("Parts are already recorded for this job.");
  await db.$transaction(async (tx) => {
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { noPartsUsed: true },
    });
  });
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/jobs/${complaintId}`);
}

export async function completeService(complaintId: string, formData: FormData) {
  const { user } = await requireComplaintAccess(complaintId);
  const completionNotes = requiredText(
    formData.get("completionNotes"),
    "Completion notes",
  );
  const charges = nonNegativeNumber(
    requiredText(formData.get("charges"), "Service amount"),
    "Service amount",
  );
  const collectedNow = nonNegativeNumber(
    formData.get("collectedNow"),
    "Collected now",
  );
  const paymentMode = String(formData.get("paymentMode") || PaymentMode.CASH);
  if (!Object.values(PaymentMode).includes(paymentMode as PaymentMode))
    throw new Error("Invalid payment mode.");
  if (collectedNow > charges + 0.001)
    throw new Error("Collected amount cannot be more than service amount.");
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: {
        customer: true,
        equipment: true,
        currentTechnician: true,
        inspection: true,
        workLogs: { orderBy: { createdAt: "asc" } },
        parts: true,
        serviceRecord: true,
      },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (complaint.serviceRecord)
      throw new Error("This service is already completed.");
    if (terminalStatuses.includes(complaint.status))
      throw new Error("This complaint is closed or cancelled and cannot be completed.");
    if (user.role === UserRole.TECHNICIAN && complaint.currentTechnicianId !== user.technicianId)
      throw new Error("You are no longer assigned to this job.");
    if (user.role === UserRole.TECHNICIAN && complaint.status === ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL)
      throw new Error("Ask the office to confirm customer approval before completing this service.");
    if (!complaint.currentTechnician)
      throw new Error("A technician must be assigned before completion.");
    if (!complaint.inspection?.actualProblem)
      throw new Error("Problem Found is required before completion.");
    if (!complaint.workLogs.length)
      throw new Error("Work Done is required before completion.");
    const serviceDate = new Date();
    const serviceNumber = await nextDocumentNumber(tx, "service", "VFE-SVC-");
    const workDone = complaint.workLogs
      .map((w) => `• ${w.workDone}`)
      .join("\n");
    const partsSummary = complaint.parts.length
      ? complaint.parts
          .map(
            (p) =>
              `${p.partName} × ${p.quantity.toString()} @ ₹${p.unitPrice.toString()}`,
          )
          .join("; ")
      : "Not recorded";
    const wStatus = warrantyStatus(
      complaint.equipment?.warrantyExpiryDate,
      serviceDate,
    );
    const record = await tx.serviceRecord.create({
      data: {
        serviceNumber,
        complaintId: complaint.id,
        customerId: complaint.customerId,
        equipmentId: complaint.equipmentId,
        technicianId: complaint.currentTechnicianId,
        serviceDate,
        complaintReported: complaint.customerComplaint,
        problemFound: complaint.inspection.actualProblem,
        workDone,
        partsSummary,
        technicianNameSnapshot: complaint.currentTechnician.name,
        customerNameSnapshot: complaint.customer.name,
        customerPhoneSnapshot: complaint.customer.primaryMobile,
        customerAddressSnapshot: [
          complaint.customer.address,
          complaint.customer.city,
          complaint.customer.state,
          complaint.customer.pinCode,
        ]
          .filter(Boolean)
          .join(", "),
        equipmentNameSnapshot: complaint.equipment?.name ?? null,
        equipmentBrandSnapshot: complaint.equipment?.brand ?? null,
        modelSnapshot: complaint.equipment?.modelNumber ?? null,
        serialSnapshot: complaint.equipment?.serialNumber ?? null,
        warrantyExpirySnapshot: complaint.equipment?.warrantyExpiryDate ?? null,
        warrantyStatus: wStatus,
        notes: null,
        completionNotes,
        charges,
      },
    });
    await tx.servicePart.updateMany({
      where: { complaintId },
      data: { serviceRecordId: record.id },
    });
    if (collectedNow > 0) {
      const collectionNumber = await nextDocumentNumber(
        tx,
        "service_collection",
        "VFE-COL-",
      );
      await tx.serviceCollection.create({
        data: {
          collectionNumber,
          serviceRecordId: record.id,
          complaintId: complaint.id,
          customerId: complaint.customerId,
          equipmentId: complaint.equipmentId,
          technicianId: complaint.currentTechnicianId,
          collectedById: user.id,
          amount: collectedNow,
          paymentMode: paymentMode as PaymentMode,
          collectedAt: serviceDate,
          notes: "Collected during service completion.",
        },
      });
    }
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { status: ServiceStatus.SERVICE_COMPLETED, closedAt: serviceDate },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: complaint.status,
        newStatus: ServiceStatus.SERVICE_COMPLETED,
        changedById: user.id,
        notes:
          completionNotes ?? "Service completed and permanent history created.",
      },
    });
    await tx.serviceAssignment.updateMany({
      where: { complaintId, isActive: true },
      data: {
        isActive: false,
        unassignedAt: serviceDate,
        endedReason: "Service completed",
      },
    });
    const otherJobs = await tx.serviceComplaint.count({
      where: {
        currentTechnicianId: complaint.currentTechnicianId,
        id: { not: complaintId },
        status: {
          notIn: [
            ServiceStatus.SERVICE_COMPLETED,
            ServiceStatus.CLOSED,
            ServiceStatus.CANCELLED,
          ],
        },
      },
    });
    await tx.technician.update({
      where: { id: complaint.currentTechnician.id },
      data: {
        status: otherJobs ? TechnicianStatus.BUSY : TechnicianStatus.AVAILABLE,
      },
    });
    return record;
  });
  revalidateOperationalLookups();
  revalidatePath("/service-history");
  revalidatePath("/service-collections");
  revalidatePath(`/service-history/${result.id}`);
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/complaints");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/teams");
  redirect(`/service-history/${result.id}`);
}

function complaintIdFrom(formData: FormData) {
  const complaintId = String(formData.get("complaintId") ?? "").trim();
  if (!complaintId) throw new Error("Complaint is required.");
  return complaintId;
}

export async function saveInspectionFromForm(formData: FormData) {
  return saveInspection(complaintIdFrom(formData), formData);
}

export async function addWorkLogFromForm(formData: FormData) {
  return addWorkLog(complaintIdFrom(formData), formData);
}

export async function addServicePartFromForm(formData: FormData) {
  return addServicePart(complaintIdFrom(formData), formData);
}

export async function markNoPartsUsedFromForm(formData: FormData) {
  return markNoPartsUsed(complaintIdFrom(formData));
}

export async function updateServiceStatusFromForm(formData: FormData) {
  return updateServiceStatus(complaintIdFrom(formData), formData);
}

export async function completeServiceFromForm(formData: FormData) {
  return completeService(complaintIdFrom(formData), formData);
}

function titleCaseStatus(status: ServiceStatus) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
