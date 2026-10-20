"use server";
import bcrypt from "bcryptjs";
import { TechnicianStatus, UserRole } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/ids";
import { optionalString } from "@/lib/format";
import { assertLoginIdentifiers, requiredEmail } from "@/lib/technician-validation";

export async function createTechnician(formData: FormData) {
  await requireRoles(["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const email = requiredEmail(formData.get("email"));
  if (!name || !mobile || !username || password.length < 8)
    throw new Error(
      "Name, mobile, username and password (8+ chars) are required.",
    );
  const passwordHash = await bcrypt.hash(password, 12);
  const specialization = optionalString(formData.get("specialization"));
  const tech = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713043)`;
    await assertLoginIdentifiers(tx, username, email);
    const technicianCode = await nextDocumentNumber(
      tx,
      "technician",
      "VFE-TECH-",
    );
    const user = await tx.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: UserRole.TECHNICIAN,
        email,
        specialization,
      },
    });
    const row = await tx.technician.create({
      data: {
        technicianCode,
        name,
        mobile,
        email,
        address: optionalString(formData.get("address")),
        specialization,
        userId: user.id,
        status: TechnicianStatus.AVAILABLE,
      },
    });
    return row;
  });
  revalidateTag("authorization-users");
  revalidateTag("technician-options");
  revalidatePath("/teams");
  redirect(`/technicians/${tech.id}`);
}

export async function updateTechnician(id: string, formData: FormData) {
  await requireRoles(["ADMIN"]);

  const technician = await db.technician.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!technician) throw new Error("Technician not found.");

  const name = String(formData.get("name") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const email = requiredEmail(formData.get("email"));
  const specialization = optionalString(formData.get("specialization"));
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!name || !mobile) throw new Error("Name and mobile are required.");
  if (technician.user && !username)
    throw new Error("Login username is required.");
  if (newPassword && newPassword.length < 8)
    throw new Error("New password must contain at least 8 characters.");

  const passwordHash = newPassword
    ? await bcrypt.hash(newPassword, 12)
    : undefined;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(713043)`;
    if (technician.user) await assertLoginIdentifiers(tx, username, email, technician.user.id);
    await tx.technician.update({
      where: { id },
      data: {
        name,
        mobile,
        email,
        address: optionalString(formData.get("address")),
        specialization,
      },
    });

    if (technician.user) {
      await tx.user.update({
        where: { id: technician.user.id },
        data: {
          name,
          username,
          email,
          specialization,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
    }
  });

  revalidateTag("authorization-users");
  revalidateTag("technician-options");
  revalidatePath("/teams");
  revalidatePath(`/technicians/${id}`);
  redirect(`/technicians/${id}?updated=1`);
}

export async function setTechnicianStatus(id: string, formData: FormData) {
  const actor = await requireRoles(["ADMIN"]);
  const before = await db.technician.findUnique({ where: { id } });
  if (!before) throw new Error("Technician not found.");
  const status = String(formData.get("status")) as TechnicianStatus;
  if (!Object.values(TechnicianStatus).includes(status))
    throw new Error("Invalid technician status.");
  if (
    status === TechnicianStatus.AVAILABLE ||
    status === TechnicianStatus.ON_LEAVE ||
    status === TechnicianStatus.INACTIVE
  ) {
    const openJobs = await db.serviceComplaint.count({
      where: {
        currentTechnicianId: id,
        status: { notIn: ["SERVICE_COMPLETED", "CLOSED", "CANCELLED"] },
      },
    });
    if (openJobs > 0)
      throw new Error(
        "Reassign or complete this technician’s open jobs before changing to that status.",
      );
  }
  await db.$transaction(async (tx) => {
    await tx.technician.update({
      where: { id },
      data: { status, isActive: status !== TechnicianStatus.INACTIVE },
    });
  });
  revalidateTag("authorization-users");
  revalidateTag("technician-options");
  revalidatePath("/teams");
  revalidatePath(`/technicians/${id}`);
  revalidatePath("/teams");
}

export async function deleteTechnicianFromForm(formData: FormData) {
  await requireRoles(["ADMIN"]);
  const id = String(formData.get("technicianId") ?? "").trim();
  if (!id) throw new Error("Technician is required.");

  await db.$transaction(async (tx) => {
    const technician = await tx.technician.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true },
    });
    if (!technician) throw new Error("Technician not found.");

    const [openComplaints, assignments, serviceRecords, collections] =
      await Promise.all([
        tx.serviceComplaint.count({ where: { currentTechnicianId: id } }),
        tx.serviceAssignment.count({ where: { technicianId: id } }),
        tx.serviceRecord.count({ where: { technicianId: id } }),
        tx.serviceCollection.count({ where: { technicianId: id } }),
      ]);

    if (openComplaints || assignments || serviceRecords || collections) {
      throw new Error(
        "Cannot delete this technician because job assignment, complaint, service history or collection records exist. Disable the account/status instead.",
      );
    }

    await tx.technician.delete({ where: { id } });

    if (technician.userId) {
      await tx.user.delete({
        where: { id: technician.userId },
      });
    }
  });

  revalidateTag("authorization-users");
  revalidateTag("technician-options");
  revalidatePath("/teams");
  redirect("/teams");
}
