import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCachedAuthorizationUser } from "@/lib/cached-lookups";
import { authenticateCredentials } from "@/lib/auth-credentials";
import type { UserRole } from "@prisma/client";
import { cache } from "react";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "VFE Login",
      credentials: {
        username: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authenticateCredentials(credentials, (where) =>
          db.user.findMany({
            where,
            take: 2,
            include: { technician: { select: { id: true, isActive: true } } },
          }),
        );
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.technicianId = (user as any).technicianId;
        token.canAssignTechnician = (user as any).canAssignTechnician;
        token.canGenerateBills = (user as any).canGenerateBills;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.technicianId =
          (token.technicianId as string | null) ?? null;
        session.user.canAssignTechnician = Boolean(token.canAssignTechnician);
        session.user.canGenerateBills = Boolean(token.canGenerateBills);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  // JWT sessions can otherwise remain usable for hours after an account is
  // disabled or its permissions change. Refresh authorization-critical fields
  // from the database with a short cache that is invalidated on staff changes.
  const user = await getCachedAuthorizationUser(session.user.id);
  if (
    !user?.isActive ||
    (user.role === "TECHNICIAN" && !user.technician?.isActive)
  )
    return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    technicianId: user.technician?.id ?? null,
    canAssignTechnician: user.canAssignTechnician,
    canGenerateBills: user.canGenerateBills,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRoles(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(user.role === "TECHNICIAN" ? "/jobs?error=forbidden" : "/dashboard?error=forbidden");
  return user;
}

export async function requireOfficeUser() {
  return requireRoles(["ADMIN", "OFFICE_STAFF"]);
}
