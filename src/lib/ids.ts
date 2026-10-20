import type { Prisma } from "@prisma/client";

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string,
  digits = 4,
) {
  return (await nextDocumentNumbers(tx, key, prefix, 1, digits))[0];
}

export async function nextDocumentNumbers(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string,
  count: number,
  digits = 4,
) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid document count.");
  const row = await tx.documentSequence.upsert({
    where: { key },
    create: { key, value: count },
    update: { value: { increment: count } },
  });
  return Array.from({ length: count }, (_, index) => `${prefix}${String(row.value - count + index + 1).padStart(digits, "0")}`);
}
