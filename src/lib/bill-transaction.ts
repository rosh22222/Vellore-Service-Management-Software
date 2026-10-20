import type { Prisma } from "@prisma/client";
import { db } from "./db";

export function billTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(action, { maxWait: 10000, timeout: 60000 });
}

export async function lockBill(tx: Prisma.TransactionClient, billId: string) {
  await tx.$queryRaw`SELECT "id" FROM "BillDetail" WHERE "id" = ${billId} FOR UPDATE`;
}
