import type { Prisma } from "@prisma/client";

export async function suggestedInvoiceNumber(db: Pick<Prisma.TransactionClient, "billDetail">) {
  const bills = await db.billDetail.findMany({
    where: { billNumber: { startsWith: "VFE-INV-" } },
    select: { billNumber: true },
  });
  const highest = bills.reduce((max, bill) => {
    const match = /^VFE-INV-(\d+)$/.exec(bill.billNumber);
    const value = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(value) ? Math.max(max, value) : max;
  }, 0);
  return `VFE-INV-${String(highest + 1).padStart(4, "0")}`;
}
