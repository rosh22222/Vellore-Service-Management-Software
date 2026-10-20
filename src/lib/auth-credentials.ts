import bcrypt from "bcryptjs";
import type { Prisma, User } from "@prisma/client";

export type LoginAccount = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "passwordHash"
  | "role"
  | "isActive"
  | "canAssignTechnician"
  | "canGenerateBills"
> & { technician: { id: string; isActive: boolean } | null };

type Credentials = { username?: unknown; password?: unknown } | undefined;
type FindAccounts = (where: Prisma.UserWhereInput) => Promise<readonly LoginAccount[]>;

export async function authenticateCredentials(
  credentials: Credentials,
  findAccounts: FindAccounts,
) {
  if (
    typeof credentials?.username !== "string" ||
    typeof credentials.password !== "string" ||
    !credentials.password
  ) return null;

  const identifier = credentials.username.trim().toLowerCase();
  if (!identifier) return null;

  const accounts = await findAccounts({
    OR: [
      { username: { equals: identifier, mode: "insensitive" } },
      { email: { equals: identifier, mode: "insensitive" } },
    ],
  });
  // Username/email are individually unique, but can collide across accounts or
  // differ only by case. Never select an arbitrary account in that situation.
  if (accounts.length !== 1) return null;
  const user = accounts[0];
  if (
    !user.isActive ||
    (user.role === "TECHNICIAN" && !user.technician?.isActive)
  ) return null;

  if (!(await bcrypt.compare(credentials.password, user.passwordHash))) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    technicianId: user.technician?.id ?? null,
    canAssignTechnician: user.canAssignTechnician,
    canGenerateBills: user.canGenerateBills,
  };
}
