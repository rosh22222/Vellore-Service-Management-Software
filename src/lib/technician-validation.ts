import { requiredText } from "./format";
import type { Prisma } from "@prisma/client";
export function requiredEmail(value: FormDataEntryValue | null) {
  const email = requiredText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
  return email;
}
export async function assertLoginIdentifiers(tx: Pick<Prisma.TransactionClient, "user">, username: string, email: string, currentId?: string) {
  const identifiers = [username, email];
  const existing = await tx.user.findFirst({ where: { ...(currentId ? { id: { not: currentId } } : {}), OR: [{ username: { in: identifiers, mode: "insensitive" } }, { email: { in: identifiers, mode: "insensitive" } }] }, select: { id: true } });
  if (existing) throw new Error("This username or email is already in use. Please choose another.");
}
