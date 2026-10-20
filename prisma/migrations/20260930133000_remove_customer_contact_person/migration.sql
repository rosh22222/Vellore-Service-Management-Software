-- Drop unused customer contact-person field.
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "contactPerson";
