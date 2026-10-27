"use server";
import { lockEquipmentBills } from "@/lib/bill-edit";

import {
  ComplaintPriority,
  ComplaintSource,
  CustomerType,
  EquipmentStatus,
  Prisma,
  ServiceStatus,
  TechnicianStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { nextDocumentNumber, nextDocumentNumbers } from "@/lib/ids";
import {
  indianPinCode,
  n,
  nonNegativeNumber,
  optionalDate,
  optionalString,
  phoneNumber,
  requiredText,
} from "@/lib/format";
import { similarity } from "@/lib/similarity";
import { warrantyStatus } from "@/lib/warranty";

function revalidateOperationalLookups() {
  revalidateTag("customer-options");
  revalidateTag("equipment-options");
  revalidateTag("technician-options");
  revalidateTag("dashboard-data");
  revalidateTag("reports-data");
}

async function requireComplaintAccess(complaintId: string) {
  const user = await requireUser();
  const complaint = await db.serviceComplaint.findUnique({
    where: { id: complaintId },
    include: {
      serviceRecord: true,
      assignments: {
        where: { isActive: true },
        select: { technicianId: true },
      },
    },
  });
  if (!complaint) throw new Error("Complaint not found.");
  if (complaint.status === ServiceStatus.CANCELLED || complaint.status === ServiceStatus.CLOSED)
    throw new Error("This complaint is closed or cancelled and cannot be changed.");
  if (
    user.role === UserRole.TECHNICIAN &&
    !complaint.assignments.some(
      (assignment) => assignment.technicianId === user.technicianId,
    )
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

type NewVisitEquipmentEntry = {
  name: string;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  customerComplaint: string;
  notes: string | null;
};

function optionalEquipmentText(
  value: FormDataEntryValue | null,
  label: string,
  maxLength: number,
) {
  const text = optionalString(value);
  if (text && text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

function parseNewVisitEquipmentEntries(formData: FormData) {
  const rowIds = [
    ...new Set(
      formData
        .getAll("equipmentRows")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  if (!rowIds.length) throw new Error("Add at least one equipment item.");
  if (rowIds.length > 25)
    throw new Error("Add no more than 25 equipment items at one time.");
  if (rowIds.some((rowId) => !/^\d+$/.test(rowId)))
    throw new Error("One of the equipment entries is invalid. Refresh and try again.");

  const entries: NewVisitEquipmentEntry[] = rowIds.map((rowId, index) => ({
    name: requiredText(
      formData.get(`equipmentName.${rowId}`),
      `Equipment ${index + 1} name`,
      200,
    ),
    brand: optionalEquipmentText(
      formData.get(`equipmentBrand.${rowId}`),
      `Equipment ${index + 1} brand`,
      200,
    ),
    modelNumber: optionalEquipmentText(
      formData.get(`equipmentModel.${rowId}`),
      `Equipment ${index + 1} model number`,
      200,
    ),
    serialNumber: optionalEquipmentText(
      formData.get(`equipmentSerial.${rowId}`),
      `Equipment ${index + 1} serial number`,
      200,
    ),
    customerComplaint: requiredText(
      formData.get(`equipmentProblem.${rowId}`),
      `Problem for equipment ${index + 1}`,
      3000,
    ),
    notes: optionalEquipmentText(
      formData.get(`equipmentNotes.${rowId}`),
      `Equipment ${index + 1} notes`,
      3000,
    ),
  }));
  const serialNumbers = entries
    .map((entry) => entry.serialNumber)
    .filter((serialNumber): serialNumber is string => Boolean(serialNumber));
  if (new Set(serialNumbers).size !== serialNumbers.length)
    throw new Error("The same serial number was entered more than once.");
  return entries;
}

export async function createComplaint(formData: FormData) {
  const user = await requireUser();
  if (user.role === UserRole.TECHNICIAN)
    throw new Error("Technicians cannot register office complaints.");
  const customerMode = String(formData.get("customerMode") || "existing");
  const equipmentMode = String(formData.get("equipmentMode") || "existing");
  if (!["existing", "new"].includes(customerMode))
    throw new Error("Choose an existing or new customer.");
  if (!["existing", "unknown", "new"].includes(equipmentMode))
    throw new Error(
      "Choose registered equipment, add equipment, or identify it later.",
    );
  if (equipmentMode === "new" && customerMode !== "new")
    throw new Error(
      "Use the customer service page to register additional equipment for an existing customer.",
    );
  const newEquipmentEntries =
    equipmentMode === "new" ? parseNewVisitEquipmentEntries(formData) : [];
  const technicianIds = [
    ...new Set(
      [
        ...formData.getAll("technicianIds"),
        formData.get("technicianId"),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (technicianIds.length > 10)
    throw new Error("Select no more than 10 technicians for one complaint.");
  if (technicianIds.length && !canAssign(user))
    throw new Error("You do not have technician assignment permission.");
  const customerComplaint =
    equipmentMode === "new"
      ? null
      : requiredText(
          formData.get("customerComplaint"),
          "Customer complaint",
        );
  const priority = String(formData.get("priority") || "NORMAL");
  const source = String(formData.get("source") || "PHONE");
  if (!Object.values(ComplaintPriority).includes(priority as ComplaintPriority))
    throw new Error("Invalid complaint priority.");
  if (!Object.values(ComplaintSource).includes(source as ComplaintSource))
    throw new Error("Invalid complaint source.");

  const complaints = await db.$transaction(async (tx) => {
    let customerId = String(formData.get("customerId") ?? "");
    if (customerMode === "new") {
      const type = requiredText(
        formData.get("newCustomerType"),
        "Customer type",
        50,
      );
      if (!Object.values(CustomerType).includes(type as CustomerType))
        throw new Error("Invalid customer type.");
      const pinCode = indianPinCode(formData.get("newCustomerPinCode"));
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
          address: requiredText(
            formData.get("newCustomerAddress"),
            "Address",
            1000,
          ),
          city: requiredText(formData.get("newCustomerCity"), "City", 120),
          state: requiredText(formData.get("newCustomerState"), "State", 120),
          pinCode,
          gstNumber: optionalString(formData.get("newCustomerGstNumber")),
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

    let complaintEntries: Array<{
      equipmentId: string | null;
      customerComplaint: string;
    }> = [{ equipmentId: null, customerComplaint: customerComplaint! }];
    if (equipmentMode === "existing") {
      if (customerMode === "new")
        throw new Error("A new customer cannot use existing equipment.");
      const selectedEquipmentIds = [
        ...new Set(
          [
            ...formData.getAll("equipmentIds"),
            formData.get("equipmentId"),
          ]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (!selectedEquipmentIds.length)
        throw new Error("Select at least one equipment.");
      if (selectedEquipmentIds.length > 25)
        throw new Error("Select no more than 25 equipment items at one time.");

      for (const equipmentId of [...selectedEquipmentIds].sort())
        await lockEquipmentBills(tx, equipmentId);
      const selectedEquipment = await tx.customerEquipment.findMany({
        where: { id: { in: selectedEquipmentIds } },
        select: { id: true, customerId: true },
      });
      if (
        selectedEquipment.length !== selectedEquipmentIds.length ||
        selectedEquipment.some((item) => item.customerId !== customerId)
      )
        throw new Error(
          "One or more selected equipment items do not belong to this customer.",
        );
      complaintEntries = selectedEquipmentIds.map((equipmentId) => ({
        equipmentId,
        customerComplaint: customerComplaint!,
      }));
    } else if (equipmentMode === "new") {
      const serialNumbers = newEquipmentEntries
        .map((entry) => entry.serialNumber)
        .filter((serialNumber): serialNumber is string => Boolean(serialNumber));
      if (serialNumbers.length) {
        const registeredSerials = await tx.customerEquipment.findMany({
          where: { serialNumber: { in: serialNumbers } },
          select: { serialNumber: true },
        });
        if (registeredSerials.length)
          throw new Error(
            `Already registered serial number: ${registeredSerials
              .map((item) => item.serialNumber)
              .filter(Boolean)
              .join(", ")}.`,
          );
      }
      const equipmentCodes = await nextDocumentNumbers(
        tx,
        "equipment",
        "VFE-EQP-",
        newEquipmentEntries.length,
      );
      complaintEntries = [];
      for (let index = 0; index < newEquipmentEntries.length; index += 1) {
        const entry = newEquipmentEntries[index];
        const createdEquipment = await tx.customerEquipment.create({
          data: {
            equipmentCode: equipmentCodes[index],
            customerId,
            name: entry.name,
            brand: entry.brand,
            modelNumber: entry.modelNumber,
            serialNumber: entry.serialNumber,
            status: EquipmentStatus.ACTIVE,
            notes: entry.notes,
          },
          select: { id: true },
        });
        complaintEntries.push({
          equipmentId: createdEquipment.id,
          customerComplaint: entry.customerComplaint,
        });
      }
    } else if (equipmentMode !== "unknown") {
      throw new Error("Invalid equipment option.");
    }

    if (technicianIds.length) {
      const selectedTechnicians = await tx.technician.findMany({
        where: { id: { in: technicianIds } },
        select: { id: true, isActive: true, status: true },
      });
      if (
        selectedTechnicians.length !== technicianIds.length ||
        selectedTechnicians.some(
          (technician) =>
            !technician.isActive ||
            technician.status === TechnicianStatus.INACTIVE ||
            technician.status === TechnicianStatus.ON_LEAVE,
        )
      )
        throw new Error("One or more selected technicians are not available.");
    }

    const complaintNumbers = await nextDocumentNumbers(
      tx,
      "complaint",
      "VFE-SRV-",
      complaintEntries.length,
    );
    const createdRows = [];
    for (let index = 0; index < complaintEntries.length; index += 1) {
      const entry = complaintEntries[index];
      const { repeatIssueDetected, repeatReferenceServiceId } =
        await detectRepeatIssue(
          tx,
          entry.equipmentId,
          entry.customerComplaint,
        );
      const row = await tx.serviceComplaint.create({
        data: {
          complaintNumber: complaintNumbers[index],
          complaintDate:
            optionalDate(formData.get("complaintDate")) ?? new Date(),
          customerId,
          equipmentId: entry.equipmentId,
          customerComplaint: entry.customerComplaint,
          complaintCategory: optionalString(formData.get("complaintCategory")),
          priority: priority as ComplaintPriority,
          preferredVisitDate: optionalDate(formData.get("preferredVisitDate")),
          notes: optionalString(formData.get("notes")),
          source: source as ComplaintSource,
          status: technicianIds.length
            ? ServiceStatus.TECHNICIAN_ASSIGNED
            : ServiceStatus.UNASSIGNED,
          currentTechnicianId: technicianIds[0] ?? null,
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
      if (technicianIds.length) {
        await tx.serviceAssignment.createMany({
          data: technicianIds.map((technicianId) => ({
            complaintId: row.id,
            technicianId,
            assignedById: user.id,
            reason: "Assigned during complaint registration.",
          })),
        });
      }
      createdRows.push(row);
    }
    if (createdRows.length > 1) {
      await tx.serviceComplaint.updateMany({
        where: { id: { in: createdRows.map((row) => row.id) } },
        data: { serviceVisitGroupId: createdRows[0].id },
      });
    }
    if (technicianIds.length) {
      await tx.technician.updateMany({
        where: { id: { in: technicianIds } },
        data: { status: TechnicianStatus.BUSY },
      });
    }
    return createdRows;
  }, { maxWait: 10_000, timeout: 30_000 });
  revalidateOperationalLookups();
  revalidatePath("/customers");
  revalidatePath("/equipment");
  revalidatePath("/complaints");
  revalidatePath("/teams");
  revalidatePath("/dashboard");
  if (equipmentMode === "new")
    redirect(
      `/complaints/${complaints[0].id}?equipmentAdded=${complaints.length}#equipment-services`,
    );
  if (complaints.length === 1) redirect(`/complaints/${complaints[0].id}`);
  redirect(`/complaints?created=${complaints.length}`);
}

async function resolveServiceEquipment(
  tx: Prisma.TransactionClient,
  customerId: string,
  equipmentMode: string,
  formData: FormData,
) {
  if (equipmentMode === "existing") {
    const equipmentId = optionalString(formData.get("equipmentId"));
    if (!equipmentId) throw new Error("Equipment is required.");
    await lockEquipmentBills(tx, equipmentId);
    const equipment = await tx.customerEquipment.findUnique({
      where: { id: equipmentId },
      select: { customerId: true },
    });
    if (!equipment || equipment.customerId !== customerId)
      throw new Error("The selected equipment does not belong to this customer.");
    return equipmentId;
  }

  if (equipmentMode !== "new") throw new Error("Invalid equipment option.");
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
      customerId,
      name: requiredText(formData.get("newEquipmentName"), "Equipment name", 200),
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
  return equipment.id;
}

export async function linkComplaintEquipmentFromForm(formData: FormData) {
  const complaintId = String(formData.get("complaintId") ?? "").trim();
  const equipmentMode = String(formData.get("equipmentMode") || "existing");
  if (!complaintId) throw new Error("Complaint is required.");
  const { user } = await requireComplaintAccess(complaintId);

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: {
        serviceRecord: true,
        assignments: {
          where: { isActive: true },
          select: { technicianId: true },
        },
      },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (complaint.serviceRecord)
      throw new Error("Completed service records are immutable.");
    if (
      user.role === UserRole.TECHNICIAN &&
      !complaint.assignments.some(
        (assignment) => assignment.technicianId === user.technicianId,
      )
    )
      throw new Error("You are not assigned to this job.");
    if (user.role === UserRole.TECHNICIAN && complaint.equipmentId)
      throw new Error(
        "This job already has equipment linked. Ask the office to correct it.",
      );
    if (user.role === UserRole.TECHNICIAN && equipmentMode === "unknown")
      throw new Error("Only office staff can remove an equipment link.");

    let equipmentId: string | null = null;
    if (equipmentMode !== "unknown")
      equipmentId = await resolveServiceEquipment(
        tx,
        complaint.customerId,
        equipmentMode,
        formData,
      );

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

export async function registerAndLinkVisitEquipmentFromForm(
  formData: FormData,
) {
  const complaintId = requiredText(
    formData.get("complaintId"),
    "Service complaint",
    100,
  );
  const entries = parseNewVisitEquipmentEntries(formData);
  const serialNumbers = entries
    .map((entry) => entry.serialNumber)
    .filter((serialNumber): serialNumber is string => Boolean(serialNumber));
  if (new Set(serialNumbers).size !== serialNumbers.length)
    throw new Error("The same serial number was entered more than once.");

  const { user } = await requireComplaintAccess(complaintId);
  const result = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
      const source = await tx.serviceComplaint.findUnique({
        where: { id: complaintId },
        include: {
          serviceRecord: true,
          assignments: {
            where: { isActive: true },
            select: { technicianId: true },
            orderBy: { assignedAt: "asc" },
          },
        },
      });
      if (!source) throw new Error("Complaint not found.");
      if (source.serviceRecord || terminalStatuses.includes(source.status))
        throw new Error("Equipment cannot be added to a completed job.");
      if (source.equipmentId)
        throw new Error(
          "Equipment is already linked to this complaint. Add another machine from the visit workspace instead.",
        );
      if (
        user.role === UserRole.TECHNICIAN &&
        !source.assignments.some(
          (assignment) => assignment.technicianId === user.technicianId,
        )
      )
        throw new Error("You are not assigned to this job.");

      if (serialNumbers.length) {
        const registeredSerials = await tx.customerEquipment.findMany({
          where: { serialNumber: { in: serialNumbers } },
          select: { serialNumber: true },
        });
        if (registeredSerials.length)
          throw new Error(
            `Already registered serial number: ${registeredSerials
              .map((equipment) => equipment.serialNumber)
              .filter(Boolean)
              .join(", ")}.`,
          );
      }

      const equipmentCodes = await nextDocumentNumbers(
        tx,
        "equipment",
        "VFE-EQP-",
        entries.length,
      );
      const createdEquipment: Array<{ id: string }> = [];
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        createdEquipment.push(
          await tx.customerEquipment.create({
            data: {
              equipmentCode: equipmentCodes[index],
              customerId: source.customerId,
              name: entry.name,
              brand: entry.brand,
              modelNumber: entry.modelNumber,
              serialNumber: entry.serialNumber,
              status: EquipmentStatus.ACTIVE,
              notes: entry.notes,
            },
            select: { id: true },
          }),
        );
      }

      const serviceVisitGroupId = source.serviceVisitGroupId ?? source.id;
      const firstRepeat = await detectRepeatIssue(
        tx,
        createdEquipment[0].id,
        entries[0].customerComplaint,
      );
      await tx.serviceComplaint.update({
        where: { id: source.id },
        data: {
          equipmentId: createdEquipment[0].id,
          customerComplaint: entries[0].customerComplaint,
          serviceVisitGroupId,
          ...firstRepeat,
        },
      });

      const technicianIds = source.assignments.map(
        (assignment) => assignment.technicianId,
      );
      const currentTechnicianId =
        source.currentTechnicianId &&
        technicianIds.includes(source.currentTechnicianId)
          ? source.currentTechnicianId
          : technicianIds[0] ?? null;
      const additionalComplaintNumbers =
        entries.length > 1
          ? await nextDocumentNumbers(
              tx,
              "complaint",
              "VFE-SRV-",
              entries.length - 1,
            )
          : [];
      for (let index = 1; index < entries.length; index += 1) {
        const entry = entries[index];
        const repeat = await detectRepeatIssue(
          tx,
          createdEquipment[index].id,
          entry.customerComplaint,
        );
        const complaint = await tx.serviceComplaint.create({
          data: {
            complaintNumber: additionalComplaintNumbers[index - 1],
            complaintDate: source.complaintDate,
            customerId: source.customerId,
            equipmentId: createdEquipment[index].id,
            customerComplaint: entry.customerComplaint,
            complaintCategory: source.complaintCategory,
            priority: source.priority,
            preferredVisitDate: source.preferredVisitDate,
            notes: source.notes,
            source: source.source,
            status: technicianIds.length
              ? ServiceStatus.TECHNICIAN_ASSIGNED
              : ServiceStatus.UNASSIGNED,
            currentTechnicianId,
            createdById: user.id,
            serviceVisitGroupId,
            ...repeat,
          },
        });
        await tx.serviceStatusHistory.create({
          data: {
            complaintId: complaint.id,
            previousStatus: ServiceStatus.COMPLAINT_RECEIVED,
            newStatus: complaint.status,
            changedById: user.id,
            notes: `Equipment registered during the same visit as ${source.complaintNumber}.`,
          },
        });
        if (technicianIds.length) {
          await tx.serviceAssignment.createMany({
            data: technicianIds.map((technicianId) => ({
              complaintId: complaint.id,
              technicianId,
              assignedById: user.id,
              reason: `Assigned during the same visit as ${source.complaintNumber}.`,
            })),
          });
        }
      }

      if (technicianIds.length) {
        await tx.technician.updateMany({
          where: { id: { in: technicianIds } },
          data: { status: TechnicianStatus.BUSY },
        });
      }
      return {
        customerId: source.customerId,
        equipmentIds: createdEquipment.map((equipment) => equipment.id),
        equipmentCount: entries.length,
      };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  revalidateOperationalLookups();
  for (const path of [
    "/customers",
    "/equipment",
    "/complaints",
    "/jobs",
    "/teams",
    "/dashboard",
    `/customers/${result.customerId}`,
    `/complaints/${complaintId}`,
    `/jobs/${complaintId}`,
  ])
    revalidatePath(path);
  for (const equipmentId of result.equipmentIds)
    revalidatePath(`/equipment/${equipmentId}`);
  redirect(
    user.role === UserRole.TECHNICIAN
      ? `/jobs/${complaintId}?equipmentAdded=${result.equipmentCount}#equipment-services`
      : `/complaints/${complaintId}?equipmentAdded=${result.equipmentCount}#equipment-services`,
  );
}

export async function addComplaintEquipmentServiceFromForm(formData: FormData) {
  const sourceComplaintId = requiredText(
    formData.get("sourceComplaintId"),
    "Source complaint",
    100,
  );
  const equipmentMode = String(formData.get("equipmentMode") || "existing");
  if (!["existing", "new"].includes(equipmentMode))
    throw new Error("Choose registered or external equipment.");
  const requestedEquipmentIds = equipmentMode === "existing"
    ? [
        ...new Set(
          [...formData.getAll("equipmentIds"), formData.get("equipmentId")]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean),
        ),
      ]
    : [];
  if (equipmentMode === "existing" && !requestedEquipmentIds.length)
    throw new Error("Select at least one equipment item.");
  if (requestedEquipmentIds.length > 25)
    throw new Error("Select no more than 25 equipment items at one time.");
  const externalProblem = equipmentMode === "new"
    ? requiredText(
        formData.get("customerComplaint"),
        "Problem on this equipment",
        3000,
      )
    : null;
  const { user } = await requireComplaintAccess(sourceComplaintId);

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${sourceComplaintId} FOR UPDATE`;
    const source = await tx.serviceComplaint.findUnique({
      where: { id: sourceComplaintId },
      include: {
        serviceRecord: true,
        assignments: {
          where: { isActive: true },
          select: { technicianId: true },
          orderBy: { assignedAt: "asc" },
        },
      },
    });
    if (!source) throw new Error("Complaint not found.");
    if (source.serviceRecord || terminalStatuses.includes(source.status))
      throw new Error("Additional equipment cannot be added to a completed job.");
    if (
      user.role === UserRole.TECHNICIAN &&
      !source.assignments.some(
        (assignment) => assignment.technicianId === user.technicianId,
      )
    )
      throw new Error("You are not assigned to this job.");

    let equipmentEntries: Array<{
      equipmentId: string;
      customerComplaint: string;
    }>;
    if (equipmentMode === "existing") {
      for (const equipmentId of [...requestedEquipmentIds].sort())
        await lockEquipmentBills(tx, equipmentId);
      const registeredEquipment = await tx.customerEquipment.findMany({
        where: { id: { in: requestedEquipmentIds } },
        select: { id: true, customerId: true, name: true },
      });
      if (
        registeredEquipment.length !== requestedEquipmentIds.length ||
        registeredEquipment.some(
          (equipment) => equipment.customerId !== source.customerId,
        )
      )
        throw new Error(
          "One or more selected equipment items do not belong to this customer.",
        );
      if (requestedEquipmentIds.includes(source.equipmentId ?? ""))
        throw new Error("The current job's equipment cannot be added again.");
      const equipmentNames = new Map(
        registeredEquipment.map((equipment) => [equipment.id, equipment.name]),
      );
      equipmentEntries = requestedEquipmentIds.map((equipmentId) => ({
        equipmentId,
        customerComplaint: `Service requested for ${equipmentNames.get(equipmentId) ?? "this equipment"} during visit ${source.complaintNumber}.`,
      }));
    } else {
      const equipmentId = await resolveServiceEquipment(
        tx,
        source.customerId,
        equipmentMode,
        formData,
      );
      equipmentEntries = [
        { equipmentId, customerComplaint: externalProblem! },
      ];
    }

    const existingOpenComplaints = await tx.serviceComplaint.findMany({
      where: {
        id: { not: sourceComplaintId },
        equipmentId: { in: equipmentEntries.map((item) => item.equipmentId) },
        status: { notIn: terminalStatuses },
      },
      select: { complaintNumber: true, equipmentId: true },
    });
    if (existingOpenComplaints.length)
      throw new Error(
        `Selected equipment already has open complaint ${existingOpenComplaints
          .map((complaint) => complaint.complaintNumber)
          .join(", ")}.`,
      );

    const serviceVisitGroupId = source.serviceVisitGroupId ?? source.id;
    if (!source.serviceVisitGroupId) {
      await tx.serviceComplaint.update({
        where: { id: source.id },
        data: { serviceVisitGroupId },
      });
    }
    const complaintNumbers = await nextDocumentNumbers(
      tx,
      "complaint",
      "VFE-SRV-",
      equipmentEntries.length,
    );
    const technicianIds = source.assignments.map(
      (assignment) => assignment.technicianId,
    );
    const currentTechnicianId = source.currentTechnicianId &&
      technicianIds.includes(source.currentTechnicianId)
      ? source.currentTechnicianId
      : technicianIds[0] ?? null;
    const complaintDate = new Date();
    const complaints = [];
    for (let index = 0; index < equipmentEntries.length; index += 1) {
      const entry = equipmentEntries[index];
      const { repeatIssueDetected, repeatReferenceServiceId } =
        await detectRepeatIssue(
          tx,
          entry.equipmentId,
          entry.customerComplaint,
        );
      const complaint = await tx.serviceComplaint.create({
        data: {
          complaintNumber: complaintNumbers[index],
          complaintDate,
          customerId: source.customerId,
          equipmentId: entry.equipmentId,
          customerComplaint: entry.customerComplaint,
          complaintCategory: source.complaintCategory,
          priority: source.priority,
          preferredVisitDate: source.preferredVisitDate,
          notes: source.notes,
          source: source.source,
          status: technicianIds.length
            ? ServiceStatus.TECHNICIAN_ASSIGNED
            : ServiceStatus.UNASSIGNED,
          currentTechnicianId,
          createdById: user.id,
          serviceVisitGroupId,
          repeatIssueDetected,
          repeatReferenceServiceId,
        },
      });
      await tx.serviceStatusHistory.create({
        data: {
          complaintId: complaint.id,
          previousStatus: ServiceStatus.COMPLAINT_RECEIVED,
          newStatus: complaint.status,
          changedById: user.id,
          notes: `Additional equipment added from ${source.complaintNumber}.`,
        },
      });
      if (technicianIds.length) {
        await tx.serviceAssignment.createMany({
          data: technicianIds.map((technicianId) => ({
            complaintId: complaint.id,
            technicianId,
            assignedById: user.id,
            reason: `Added during the same visit as ${source.complaintNumber}.`,
          })),
        });
      }
      complaints.push(complaint);
    }
    if (technicianIds.length) {
      await tx.technician.updateMany({
        where: { id: { in: technicianIds } },
        data: { status: TechnicianStatus.BUSY },
      });
    }
    return {
      complaints,
      equipmentIds: equipmentEntries.map((item) => item.equipmentId),
      customerId: source.customerId,
    };
  });

  revalidateOperationalLookups();
  for (const path of [
    "/complaints",
    "/jobs",
    "/teams",
    "/dashboard",
    `/customers/${result.customerId}`,
    `/complaints/${sourceComplaintId}`,
    `/jobs/${sourceComplaintId}`,
  ])
    revalidatePath(path);
  for (const equipmentId of result.equipmentIds)
    revalidatePath(`/equipment/${equipmentId}`);
  redirect(
    user.role === UserRole.TECHNICIAN
      ? `/jobs/${sourceComplaintId}?equipmentAdded=${result.complaints.length}`
      : `/complaints/${sourceComplaintId}?equipmentAdded=${result.complaints.length}`,
  );
}

export async function updateVisitEquipmentServiceFromForm(formData: FormData) {
  const complaintId = requiredText(
    formData.get("complaintId"),
    "Service complaint",
    100,
  );
  const requestedReturnId = optionalString(formData.get("returnComplaintId"));
  const customerComplaint = requiredText(
    formData.get("customerComplaint"),
    "Customer complaint / problem reported",
    3000,
  );
  const equipmentName = requiredText(
    formData.get("equipmentName"),
    "Equipment name",
    200,
  );
  const brand = optionalString(formData.get("equipmentBrand"));
  const modelNumber = optionalString(formData.get("equipmentModel"));
  const serialNumber = optionalString(formData.get("equipmentSerial"));
  const equipmentNotes = optionalString(formData.get("equipmentNotes"));
  const { user } = await requireComplaintAccess(complaintId);

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: { serviceRecord: true, equipment: true },
    });
    if (!complaint) throw new Error("Service complaint not found.");
    if (complaint.serviceRecord || terminalStatuses.includes(complaint.status))
      throw new Error(
        "Completed or closed equipment services cannot be edited.",
      );
    if (!complaint.equipment)
      throw new Error("Link or register equipment before editing its details.");

    if (serialNumber) {
      const duplicate = await tx.customerEquipment.findFirst({
        where: {
          serialNumber,
          id: { not: complaint.equipment.id },
        },
        select: { id: true },
      });
      if (duplicate)
        throw new Error("This serial number belongs to another equipment item.");
    }

    await tx.customerEquipment.update({
      where: { id: complaint.equipment.id },
      data: {
        name: equipmentName,
        brand,
        modelNumber,
        serialNumber,
        notes: equipmentNotes,
      },
    });
    const { repeatIssueDetected, repeatReferenceServiceId } =
      await detectRepeatIssue(tx, complaint.equipment.id, customerComplaint);
    await tx.serviceComplaint.update({
      where: { id: complaint.id },
      data: {
        customerComplaint,
        repeatIssueDetected,
        repeatReferenceServiceId,
      },
    });

    let returnComplaintId = complaint.id;
    if (requestedReturnId) {
      const requestedReturn = await tx.serviceComplaint.findUnique({
        where: { id: requestedReturnId },
        select: { id: true, customerId: true, serviceVisitGroupId: true },
      });
      const belongsToVisit = complaint.serviceVisitGroupId
        ? requestedReturn?.serviceVisitGroupId === complaint.serviceVisitGroupId
        : requestedReturn?.id === complaint.id;
      if (
        requestedReturn?.customerId === complaint.customerId &&
        belongsToVisit
      )
        returnComplaintId = requestedReturn.id;
    }
    return {
      returnComplaintId,
      customerId: complaint.customerId,
      equipmentId: complaint.equipment.id,
    };
  });

  revalidateOperationalLookups();
  for (const path of [
    "/complaints",
    "/jobs",
    "/dashboard",
    `/customers/${result.customerId}`,
    `/equipment/${result.equipmentId}`,
    `/complaints/${result.returnComplaintId}`,
    `/jobs/${result.returnComplaintId}`,
  ])
    revalidatePath(path);
  redirect(
    user.role === UserRole.TECHNICIAN
      ? `/jobs/${result.returnComplaintId}?equipmentUpdated=1#equipment-services`
      : `/complaints/${result.returnComplaintId}?equipmentUpdated=1#equipment-services`,
  );
}

export async function deleteVisitEquipmentServiceFromForm(formData: FormData) {
  const complaintId = requiredText(
    formData.get("complaintId"),
    "Service complaint",
    100,
  );
  const requestedReturnId = optionalString(formData.get("returnComplaintId"));
  const { user } = await requireComplaintAccess(complaintId);
  if (user.role === UserRole.TECHNICIAN)
    throw new Error(
      "Only owner or office staff can delete an equipment service entry.",
    );

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: {
        serviceRecord: true,
        inspection: { select: { id: true } },
        assignments: {
          where: { isActive: true },
          select: { technicianId: true },
        },
        _count: {
          select: {
            workLogs: true,
            parts: true,
            serviceCollections: true,
          },
        },
      },
    });
    if (!complaint) throw new Error("Service complaint not found.");
    if (
      complaint.serviceRecord ||
      complaint.inspection ||
      complaint._count.workLogs ||
      complaint._count.parts ||
      complaint._count.serviceCollections ||
      !(
        [
          ServiceStatus.UNASSIGNED,
          ServiceStatus.TECHNICIAN_ASSIGNED,
        ] as ServiceStatus[]
      ).includes(complaint.status)
    )
      throw new Error(
        "This equipment service already has work or history. It cannot be deleted safely.",
      );

    const remaining = complaint.serviceVisitGroupId
      ? await tx.serviceComplaint.findMany({
          where: {
            serviceVisitGroupId: complaint.serviceVisitGroupId,
            id: { not: complaint.id },
          },
          select: { id: true },
          orderBy: [{ complaintDate: "asc" }, { createdAt: "asc" }],
        })
      : [];
    const requestedStillExists =
      requestedReturnId && requestedReturnId !== complaint.id
        ? remaining.some((item) => item.id === requestedReturnId)
        : false;
    const returnComplaintId = requestedStillExists
      ? requestedReturnId!
      : remaining[0]?.id ?? null;
    const technicianIds = Array.from(
      new Set(complaint.assignments.map((item) => item.technicianId)),
    );

    await tx.serviceComplaint.delete({ where: { id: complaint.id } });
    for (const technicianId of technicianIds) {
      const otherActiveJobs = await tx.serviceAssignment.count({
        where: {
          technicianId,
          isActive: true,
          complaint: { status: { notIn: terminalStatuses } },
        },
      });
      await tx.technician.update({
        where: { id: technicianId },
        data: {
          status: otherActiveJobs
            ? TechnicianStatus.BUSY
            : TechnicianStatus.AVAILABLE,
        },
      });
    }
    return {
      returnComplaintId,
      customerId: complaint.customerId,
      equipmentId: complaint.equipmentId,
    };
  });

  revalidateOperationalLookups();
  for (const path of [
    "/complaints",
    "/jobs",
    "/teams",
    "/dashboard",
    `/customers/${result.customerId}`,
  ])
    revalidatePath(path);
  if (result.equipmentId) revalidatePath(`/equipment/${result.equipmentId}`);
  if (result.returnComplaintId) {
    revalidatePath(`/complaints/${result.returnComplaintId}`);
    redirect(
      `/complaints/${result.returnComplaintId}?equipmentDeleted=1#equipment-services`,
    );
  }
  redirect("/complaints?equipmentDeleted=1");
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
      include: {
        assignments: {
          where: { isActive: true },
          select: { technicianId: true },
        },
      },
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
    if (complaint.assignments.some((assignment) => assignment.technicianId === technicianId))
      throw new Error("This technician is already assigned to the complaint.");
    await tx.serviceAssignment.create({
      data: {
        complaintId,
        technicianId,
        assignedById: user.id,
        reason:
          reason ||
          (previousTechId ? "Added to service team" : "Initial assignment"),
      },
    });
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: {
        currentTechnicianId: previousTechId ?? technicianId,
        status:
          complaint.status === ServiceStatus.UNASSIGNED ||
          complaint.status === ServiceStatus.COMPLAINT_RECEIVED
            ? ServiceStatus.TECHNICIAN_ASSIGNED
            : complaint.status,
      },
    });
    await tx.technician.update({
      where: { id: technicianId },
      data: { status: TechnicianStatus.BUSY },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: complaint.status,
        newStatus:
          complaint.status === ServiceStatus.UNASSIGNED ||
          complaint.status === ServiceStatus.COMPLAINT_RECEIVED
            ? ServiceStatus.TECHNICIAN_ASSIGNED
            : complaint.status,
        changedById: user.id,
        notes: previousTechId
          ? `Additional technician assigned: ${tech.name}.${reason ? ` ${reason}` : ""}`
          : `Technician assigned: ${tech.name}.${reason ? ` ${reason}` : ""}`,
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

export async function unassignTechnicianFromForm(formData: FormData) {
  const user = await requireUser();
  if (!canAssign(user))
    throw new Error("You do not have technician assignment permission.");
  const complaintId = requiredText(formData.get("complaintId"), "Complaint");
  const technicianId = requiredText(formData.get("technicianId"), "Technician");
  const reason = optionalString(formData.get("reason")) ?? "Removed from service team";

  await db.$transaction(async (tx) => {
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: {
        assignments: {
          where: { isActive: true },
          include: { technician: { select: { name: true } } },
          orderBy: { assignedAt: "asc" },
        },
      },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (terminalStatuses.includes(complaint.status))
      throw new Error("Completed or closed complaints cannot be changed.");
    const assignment = complaint.assignments.find(
      (item) => item.technicianId === technicianId,
    );
    if (!assignment) throw new Error("This technician is not currently assigned.");

    await tx.serviceAssignment.update({
      where: { id: assignment.id },
      data: {
        isActive: false,
        unassignedAt: new Date(),
        endedReason: reason,
      },
    });
    const remaining = complaint.assignments.filter(
      (item) => item.technicianId !== technicianId,
    );
    const nextPrimaryId =
      complaint.currentTechnicianId === technicianId
        ? remaining[0]?.technicianId ?? null
        : complaint.currentTechnicianId;
    const nextStatus = remaining.length ? complaint.status : ServiceStatus.UNASSIGNED;
    await tx.serviceComplaint.update({
      where: { id: complaintId },
      data: { currentTechnicianId: nextPrimaryId, status: nextStatus },
    });
    await tx.serviceStatusHistory.create({
      data: {
        complaintId,
        previousStatus: complaint.status,
        newStatus: nextStatus,
        changedById: user.id,
        notes: `${assignment.technician.name} removed from service team. ${reason}`,
      },
    });
    const otherActiveJobs = await tx.serviceAssignment.count({
      where: {
        technicianId,
        isActive: true,
        complaint: { status: { notIn: terminalStatuses } },
      },
    });
    await tx.technician.update({
      where: { id: technicianId },
      data: {
        status: otherActiveJobs ? TechnicianStatus.BUSY : TechnicianStatus.AVAILABLE,
      },
    });
  });

  revalidateOperationalLookups();
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/complaints");
  revalidatePath("/jobs");
  revalidatePath("/teams");
  revalidatePath("/dashboard");
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
    !complaint.assignments.length
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
      complaint.assignments.length
    ) {
      await tx.serviceAssignment.updateMany({
        where: { complaintId, isActive: true },
        data: {
          isActive: false,
          unassignedAt: new Date(),
          endedReason: notes ?? titleCaseStatus(newStatus),
        },
      });
      for (const { technicianId } of complaint.assignments) {
        const openJobs = await tx.serviceAssignment.count({
          where: {
            technicianId,
            isActive: true,
            complaint: { status: { notIn: terminalStatuses } },
          },
        });
        await tx.technician.update({
          where: { id: technicianId },
          data: {
            status: openJobs ? TechnicianStatus.BUSY : TechnicianStatus.AVAILABLE,
          },
        });
      }
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
  if (!complaint.assignments.length)
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
  if (!complaint.assignments.length)
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
  const returnToVisit = formData.get("returnToVisit") === "1";
  const actualProblem = requiredText(
    formData.get("actualProblem"),
    "Actual problem found",
  );
  const workPerformed = requiredText(
    formData.get("workDone"),
    "Work performed",
  );
  const charges = nonNegativeNumber(
    requiredText(formData.get("charges"), "Service amount"),
    "Service amount",
  );
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceComplaint" WHERE id = ${complaintId} FOR UPDATE`;
    const complaint = await tx.serviceComplaint.findUnique({
      where: { id: complaintId },
      include: {
        customer: true,
        equipment: true,
        currentTechnician: true,
        inspection: true,
        parts: true,
        serviceRecord: true,
        assignments: {
          where: { isActive: true },
          include: { technician: true },
          orderBy: { assignedAt: "asc" },
        },
      },
    });
    if (!complaint) throw new Error("Complaint not found.");
    if (complaint.serviceRecord)
      throw new Error("This service is already completed.");
    if (terminalStatuses.includes(complaint.status))
      throw new Error("This complaint is closed or cancelled and cannot be completed.");
    if (
      user.role === UserRole.TECHNICIAN &&
      !complaint.assignments.some(
        (assignment) => assignment.technicianId === user.technicianId,
      )
    )
      throw new Error("You are no longer assigned to this job.");
    if (user.role === UserRole.TECHNICIAN && complaint.status === ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL)
      throw new Error("Ask the office to confirm customer approval before completing this service.");
    if (!complaint.currentTechnician)
      throw new Error("A technician must be assigned before completion.");
    if (!complaint.assignments.length)
      throw new Error("At least one active technician must be assigned before completion.");
    if (!complaint.equipment)
      throw new Error(
        "Identify or register the equipment before completing service so its permanent history is saved.",
      );

    await tx.serviceInspection.upsert({
      where: { complaintId },
      create: {
        complaintId,
        findings: actualProblem,
        actualProblem,
      },
      update: {
        findings: actualProblem,
        actualProblem,
      },
    });
    await tx.serviceWorkLog.deleteMany({ where: { complaintId } });
    await tx.serviceWorkLog.create({
      data: {
        complaintId,
        workDone: workPerformed,
        createdById: user.id,
      },
    });
    const serviceDate = new Date();
    const serviceNumber = await nextDocumentNumber(tx, "service", "VFE-SVC-");
    const workDone = `• ${workPerformed}`;
    const technicianNames = Array.from(
      new Set(complaint.assignments.map((assignment) => assignment.technician.name)),
    );
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
        problemFound: actualProblem,
        workDone,
        partsSummary,
        technicianNameSnapshot: technicianNames.join(" & "),
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
        completionNotes: null,
        charges,
      },
    });
    await tx.servicePart.updateMany({
      where: { complaintId },
      data: { serviceRecordId: record.id },
    });
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
        notes: "Service completed. Actual problem and work performed recorded.",
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
    for (const technicianId of new Set(
      complaint.assignments.map((assignment) => assignment.technicianId),
    )) {
      const otherJobs = await tx.serviceAssignment.count({
        where: {
          technicianId,
          isActive: true,
          complaint: { status: { notIn: terminalStatuses } },
        },
      });
      await tx.technician.update({
        where: { id: technicianId },
        data: {
          status: otherJobs ? TechnicianStatus.BUSY : TechnicianStatus.AVAILABLE,
        },
      });
    }
    return {
      record,
      serviceVisitGroupId: complaint.serviceVisitGroupId,
    };
  });
  revalidateOperationalLookups();
  revalidatePath("/service-history");
  revalidatePath("/service-collections");
  revalidatePath(`/service-history/${result.record.id}`);
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath("/complaints");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/teams");
  if (returnToVisit) {
    const nextService = result.serviceVisitGroupId
      ? await db.serviceComplaint.findFirst({
          where: {
            serviceVisitGroupId: result.serviceVisitGroupId,
            status: { notIn: terminalStatuses },
          },
          select: { id: true },
          orderBy: [{ complaintDate: "asc" }, { createdAt: "asc" }],
        })
      : null;
    if (nextService) {
      redirect(
        user.role === UserRole.TECHNICIAN
          ? `/jobs/${nextService.id}?equipmentCompleted=1#equipment-services`
          : `/complaints/${nextService.id}?equipmentCompleted=1#equipment-services`,
      );
    }
    if (user.role !== UserRole.TECHNICIAN)
      redirect(
        `/complaints/${complaintId}?visitCompleted=1#equipment-services`,
      );
    redirect(`/service-history/${result.record.id}?visitCompleted=1`);
  }
  redirect(`/service-history/${result.record.id}`);
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
