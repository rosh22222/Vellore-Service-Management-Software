-- Customer notes duplicated complaint and office notes, so the customer-level
-- field is removed from every workflow.
ALTER TABLE "Customer" DROP COLUMN "notes";
