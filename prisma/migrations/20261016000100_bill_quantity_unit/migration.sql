BEGIN;

CREATE TYPE "QuantityUnit" AS ENUM ('UNIT', 'KG');
ALTER TABLE "BillDetailItem" ADD COLUMN "quantityUnit" "QuantityUnit" NOT NULL DEFAULT 'UNIT';

-- Old purchases remain Unit purchases. Weight never represents a machine count.
ALTER TABLE "BillDetailItem" ADD CONSTRAINT "BillDetailItem_valid_quantity"
CHECK (
  ("quantityUnit" = 'UNIT' AND "quantity" BETWEEN 1 AND 100 AND "quantity" = trunc("quantity"))
  OR ("quantityUnit" = 'KG' AND "quantity" > 0)
);

COMMIT;
