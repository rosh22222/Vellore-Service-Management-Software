-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OFFICE_STAFF', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('GYM', 'HOME_CUSTOMER', 'HOTEL', 'APARTMENT', 'INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'RETIRED');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ComplaintSource" AS ENUM ('PHONE', 'WALK_IN', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('COMPLAINT_RECEIVED', 'UNASSIGNED', 'TECHNICIAN_ASSIGNED', 'TECHNICIAN_ACCEPTED', 'TECHNICIAN_VISITING', 'INSPECTION_STARTED', 'PROBLEM_DIAGNOSED', 'REPAIR_IN_PROGRESS', 'WAITING_FOR_SPARE_PART', 'WAITING_FOR_CUSTOMER_APPROVAL', 'SERVICE_COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TechnicianStatus" AS ENUM ('AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum

-- CreateEnum

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('UNDER_WARRANTY', 'OUT_OF_WARRANTY', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canAssignTechnician" BOOLEAN NOT NULL DEFAULT false,
    "canGenerateBills" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "name" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pinCode" TEXT,
    "gstNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEquipment" (
    "id" TEXT NOT NULL,
    "equipmentCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "installationDate" TIMESTAMP(3),
    "warrantyStartDate" TIMESTAMP(3),
    "warrantyExpiryDate" TIMESTAMP(3),
    "warrantyDuration" TEXT,
    "locationBranch" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "technicianCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "skills" TEXT,
    "specialization" TEXT,
    "joiningDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "TechnicianStatus" NOT NULL DEFAULT 'AVAILABLE',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceComplaint" (
    "id" TEXT NOT NULL,
    "complaintNumber" TEXT NOT NULL,
    "complaintDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "customerComplaint" TEXT NOT NULL,
    "complaintCategory" TEXT,
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'NORMAL',
    "preferredVisitDate" TIMESTAMP(3),
    "notes" TEXT,
    "source" "ComplaintSource" NOT NULL DEFAULT 'PHONE',
    "status" "ServiceStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "currentTechnicianId" TEXT,
    "createdById" TEXT NOT NULL,
    "repeatIssueDetected" BOOLEAN NOT NULL DEFAULT false,
    "repeatReferenceServiceId" TEXT,
    "noPartsUsed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAssignment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,

    CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceInspection" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "actualProblem" TEXT NOT NULL,
    "technicianNotes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceWorkLog" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "workDone" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStatusHistory" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "previousStatus" "ServiceStatus",
    "newStatus" "ServiceStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "stockQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePart" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "serviceRecordId" TEXT,
    "partName" TEXT NOT NULL,
    "partCode" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "warrantyApplicable" BOOLEAN NOT NULL DEFAULT false,
    "oldPartReturned" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "serviceNumber" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "technicianId" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "complaintReported" TEXT NOT NULL,
    "problemFound" TEXT NOT NULL,
    "workDone" TEXT NOT NULL,
    "partsSummary" TEXT NOT NULL,
    "technicianNameSnapshot" TEXT,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerPhoneSnapshot" TEXT NOT NULL,
    "customerAddressSnapshot" TEXT NOT NULL,
    "equipmentNameSnapshot" TEXT,
    "equipmentBrandSnapshot" TEXT,
    "modelSnapshot" TEXT,
    "serialSnapshot" TEXT,
    "warrantyExpirySnapshot" TIMESTAMP(3),
    "warrantyStatus" "WarrantyStatus" NOT NULL,
    "notes" TEXT,
    "completionNotes" TEXT,
    "charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "companyName" TEXT NOT NULL DEFAULT 'VELLORE FITNESS EQUIPMENTS',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstNumber" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "secondaryColor" TEXT NOT NULL DEFAULT '#f97316',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_primaryMobile_idx" ON "Customer"("primaryMobile");

-- CreateIndex
CREATE INDEX "Customer_city_idx" ON "Customer"("city");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEquipment_equipmentCode_key" ON "CustomerEquipment"("equipmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEquipment_serialNumber_key" ON "CustomerEquipment"("serialNumber");

-- CreateIndex
CREATE INDEX "CustomerEquipment_customerId_idx" ON "CustomerEquipment"("customerId");

-- CreateIndex
CREATE INDEX "CustomerEquipment_name_idx" ON "CustomerEquipment"("name");

-- CreateIndex
CREATE INDEX "CustomerEquipment_modelNumber_idx" ON "CustomerEquipment"("modelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_technicianCode_key" ON "Technician"("technicianCode");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_userId_key" ON "Technician"("userId");

-- CreateIndex
CREATE INDEX "Technician_name_idx" ON "Technician"("name");

-- CreateIndex
CREATE INDEX "Technician_status_idx" ON "Technician"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceComplaint_complaintNumber_key" ON "ServiceComplaint"("complaintNumber");

-- CreateIndex
CREATE INDEX "ServiceComplaint_customerId_idx" ON "ServiceComplaint"("customerId");

-- CreateIndex
CREATE INDEX "ServiceComplaint_equipmentId_idx" ON "ServiceComplaint"("equipmentId");

-- CreateIndex
CREATE INDEX "ServiceComplaint_status_idx" ON "ServiceComplaint"("status");

-- CreateIndex
CREATE INDEX "ServiceComplaint_priority_idx" ON "ServiceComplaint"("priority");

-- CreateIndex
CREATE INDEX "ServiceComplaint_currentTechnicianId_idx" ON "ServiceComplaint"("currentTechnicianId");

-- CreateIndex
CREATE INDEX "ServiceComplaint_complaintDate_idx" ON "ServiceComplaint"("complaintDate");

-- CreateIndex
CREATE INDEX "ServiceAssignment_complaintId_isActive_idx" ON "ServiceAssignment"("complaintId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceAssignment_technicianId_assignedAt_idx" ON "ServiceAssignment"("technicianId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInspection_complaintId_key" ON "ServiceInspection"("complaintId");

-- CreateIndex
CREATE INDEX "ServiceWorkLog_complaintId_createdAt_idx" ON "ServiceWorkLog"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceStatusHistory_complaintId_changedAt_idx" ON "ServiceStatusHistory"("complaintId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_partCode_key" ON "SparePart"("partCode");

-- CreateIndex
CREATE INDEX "SparePart_name_idx" ON "SparePart"("name");

-- CreateIndex
CREATE INDEX "ServicePart_complaintId_idx" ON "ServicePart"("complaintId");

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_serviceNumber_key" ON "ServiceRecord"("serviceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_complaintId_key" ON "ServiceRecord"("complaintId");

-- CreateIndex
CREATE INDEX "ServiceRecord_customerId_serviceDate_idx" ON "ServiceRecord"("customerId", "serviceDate");

-- CreateIndex
CREATE INDEX "ServiceRecord_equipmentId_serviceDate_idx" ON "ServiceRecord"("equipmentId", "serviceDate");

-- CreateIndex
CREATE INDEX "ServiceRecord_technicianId_serviceDate_idx" ON "ServiceRecord"("technicianId", "serviceDate");

-- CreateIndex

-- CreateIndex

-- AddForeignKey
ALTER TABLE "CustomerEquipment" ADD CONSTRAINT "CustomerEquipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComplaint" ADD CONSTRAINT "ServiceComplaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComplaint" ADD CONSTRAINT "ServiceComplaint_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "CustomerEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComplaint" ADD CONSTRAINT "ServiceComplaint_currentTechnicianId_fkey" FOREIGN KEY ("currentTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComplaint" ADD CONSTRAINT "ServiceComplaint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInspection" ADD CONSTRAINT "ServiceInspection_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceWorkLog" ADD CONSTRAINT "ServiceWorkLog_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceWorkLog" ADD CONSTRAINT "ServiceWorkLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatusHistory" ADD CONSTRAINT "ServiceStatusHistory_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatusHistory" ADD CONSTRAINT "ServiceStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "CustomerEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
