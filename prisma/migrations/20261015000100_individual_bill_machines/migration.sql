BEGIN;

CREATE TABLE "BillDetailItemUnit" (
  "id" TEXT NOT NULL,
  "billDetailItemId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "unitNumber" INTEGER NOT NULL,
  CONSTRAINT "BillDetailItemUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillDetailItemUnit_positive_number" CHECK ("unitNumber" > 0)
);
CREATE UNIQUE INDEX "BillDetailItemUnit_billDetailItemId_unitNumber_key" ON "BillDetailItemUnit"("billDetailItemId", "unitNumber");
CREATE UNIQUE INDEX "BillDetailItemUnit_billDetailItemId_equipmentId_key" ON "BillDetailItemUnit"("billDetailItemId", "equipmentId");
CREATE INDEX "BillDetailItemUnit_equipmentId_idx" ON "BillDetailItemUnit"("equipmentId");
ALTER TABLE "BillDetailItemUnit" ADD CONSTRAINT "BillDetailItemUnit_billDetailItemId_fkey" FOREIGN KEY ("billDetailItemId") REFERENCES "BillDetailItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillDetailItemUnit" ADD CONSTRAINT "BillDetailItemUnit_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "CustomerEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

LOCK TABLE "BillDetailItem", "CustomerEquipment" IN SHARE ROW EXCLUSIVE MODE;

-- Preserve the original machine ID and every complaint/service linked to it.
INSERT INTO "BillDetailItemUnit" ("id", "billDetailItemId", "equipmentId", "unitNumber")
SELECT 'bdu_' || md5("id" || ':1'), "id", "equipmentId", 1
FROM "BillDetailItem" WHERE "equipmentId" IS NOT NULL;

-- Existing whole-number quantities also need independent remaining machines.
-- Never guess serial numbers, reassign old history or silently round quantities.
DO $$
DECLARE
  item RECORD;
  position INTEGER;
  sequence_value INTEGER;
  machine_id TEXT;
BEGIN
  FOR item IN
    SELECT i.*, b."customerId", b."billNumber", b."billDate", e."installationDate"
    FROM "BillDetailItem" i
    JOIN "BillDetail" b ON b."id" = i."billDetailId"
    LEFT JOIN "CustomerEquipment" e ON e."id" = i."equipmentId"
  LOOP
    IF item."quantity" < 1 OR item."quantity" > 100 OR item."quantity" <> trunc(item."quantity") THEN
      RAISE EXCEPTION 'Bill item % has quantity %. Review it before migrating: machine quantity must be a whole number from 1 to 100.', item."id", item."quantity";
    END IF;
    FOR position IN 1..item."quantity"::INTEGER LOOP
      IF NOT EXISTS (SELECT 1 FROM "BillDetailItemUnit" WHERE "billDetailItemId" = item."id" AND "unitNumber" = position) THEN
        INSERT INTO "DocumentSequence" ("key", "value", "updatedAt")
        VALUES ('equipment', (SELECT COALESCE(MAX(substring("equipmentCode" from '^VFE-EQP-([0-9]+)$')::INTEGER), 0) FROM "CustomerEquipment") + 1, CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("DocumentSequence"."value", (SELECT COALESCE(MAX(substring("equipmentCode" from '^VFE-EQP-([0-9]+)$')::INTEGER), 0) FROM "CustomerEquipment")) + 1, "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "value" INTO sequence_value;
        machine_id := 'bill_machine_' || md5(item."id" || ':' || position);
        INSERT INTO "CustomerEquipment" ("id", "equipmentCode", "customerId", "name", "brand", "modelNumber", "purchaseDate", "invoiceNumber", "installationDate", "warrantyStartDate", "warrantyExpiryDate", "warrantyDuration", "notes", "updatedAt")
        VALUES (machine_id, 'VFE-EQP-' || lpad(sequence_value::TEXT, GREATEST(4, length(sequence_value::TEXT)), '0'), item."customerId", item."itemName", item."brand", item."modelNumber", item."billDate", item."billNumber", item."installationDate", item."warrantyStartDate", item."warrantyExpiryDate", item."warrantyDuration", item."notes", CURRENT_TIMESTAMP);
        INSERT INTO "BillDetailItemUnit" ("id", "billDetailItemId", "equipmentId", "unitNumber")
        VALUES ('bdu_' || md5(item."id" || ':' || position), item."id", machine_id, position);
        IF position = 1 THEN
          UPDATE "BillDetailItem" SET "equipmentId" = machine_id WHERE "id" = item."id";
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
