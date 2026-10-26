-- Group machine-specific complaints created during the same customer visit.
ALTER TABLE "ServiceComplaint" ADD COLUMN "serviceVisitGroupId" TEXT;

CREATE INDEX "ServiceComplaint_serviceVisitGroupId_idx"
ON "ServiceComplaint"("serviceVisitGroupId");
