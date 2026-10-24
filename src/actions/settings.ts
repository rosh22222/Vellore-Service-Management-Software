"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireRoles } from "@/lib/auth";
import { db } from "@/lib/db";
import { optionalString, phoneNumber, requiredText } from "@/lib/format";

export async function updateCompanySettings(formData: FormData) {
  const user = await requireRoles(["ADMIN"]);
  const before = await db.companySetting.findUnique({
    where: { id: "company" },
  });
  const data = {
    companyName: requiredText(formData.get("companyName"), "Company name", 200),
    address: optionalString(formData.get("address")),
    phone: phoneNumber(formData.get("phone"), "Phone number", false),
    email: optionalString(formData.get("email")),
    gstNumber: optionalString(formData.get("gstNumber")),
  };
  await db.$transaction(async (tx) => {
    await tx.companySetting.upsert({
      where: { id: "company" },
      update: data,
      create: { id: "company", ...data },
    });
  });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidateTag("company-settings");
}
