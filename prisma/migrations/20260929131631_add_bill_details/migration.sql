-- CreateTable
CREATE TABLE "BillDetail" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillDetailItem" (
    "id" TEXT NOT NULL,
    "billDetailId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "warrantyStartDate" TIMESTAMP(3),
    "warrantyExpiryDate" TIMESTAMP(3),
    "warrantyDuration" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillDetailItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillDetail_billNumber_key" ON "BillDetail"("billNumber");

-- CreateIndex
CREATE INDEX "BillDetail_customerId_idx" ON "BillDetail"("customerId");

-- CreateIndex
CREATE INDEX "BillDetail_billDate_idx" ON "BillDetail"("billDate");

-- CreateIndex
CREATE INDEX "BillDetailItem_billDetailId_idx" ON "BillDetailItem"("billDetailId");

-- CreateIndex
CREATE INDEX "BillDetailItem_equipmentId_idx" ON "BillDetailItem"("equipmentId");

-- CreateIndex
CREATE INDEX "BillDetailItem_itemName_idx" ON "BillDetailItem"("itemName");

-- CreateIndex
CREATE INDEX "BillDetailItem_serialNumber_idx" ON "BillDetailItem"("serialNumber");

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetailItem" ADD CONSTRAINT "BillDetailItem_billDetailId_fkey" FOREIGN KEY ("billDetailId") REFERENCES "BillDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetailItem" ADD CONSTRAINT "BillDetailItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "CustomerEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
