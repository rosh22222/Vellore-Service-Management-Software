-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateTable
CREATE TABLE "ServiceCollection" (
    "id" TEXT NOT NULL,
    "collectionNumber" TEXT NOT NULL,
    "serviceRecordId" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "technicianId" TEXT,
    "collectedById" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedFrom" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCollection_collectionNumber_key" ON "ServiceCollection"("collectionNumber");

-- CreateIndex
CREATE INDEX "ServiceCollection_serviceRecordId_idx" ON "ServiceCollection"("serviceRecordId");

-- CreateIndex
CREATE INDEX "ServiceCollection_complaintId_idx" ON "ServiceCollection"("complaintId");

-- CreateIndex
CREATE INDEX "ServiceCollection_customerId_idx" ON "ServiceCollection"("customerId");

-- CreateIndex
CREATE INDEX "ServiceCollection_technicianId_idx" ON "ServiceCollection"("technicianId");

-- CreateIndex
CREATE INDEX "ServiceCollection_collectedById_idx" ON "ServiceCollection"("collectedById");

-- CreateIndex
CREATE INDEX "ServiceCollection_collectedAt_idx" ON "ServiceCollection"("collectedAt");

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "ServiceComplaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "CustomerEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCollection" ADD CONSTRAINT "ServiceCollection_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
