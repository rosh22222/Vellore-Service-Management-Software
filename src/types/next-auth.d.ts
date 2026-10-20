import { DefaultSession } from "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      technicianId: string | null;
      canAssignTechnician: boolean;
      canGenerateBills: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    technicianId?: string | null;
    canAssignTechnician?: boolean;
    canGenerateBills?: boolean;
  }
}
