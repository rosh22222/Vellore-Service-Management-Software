"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CustomerType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/ids";
import { optionalString, requiredText } from "@/lib/format";

export async function createCustomer(formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const name = requiredText(formData.get("name"), "Customer name", 200);
  const primaryMobile = requiredText(
    formData.get("primaryMobile"),
    "Primary mobile",
    30,
  );
  const address = requiredText(formData.get("address"), "Address", 1000);
  const city = requiredText(formData.get("city"), "City", 120);
  const state = requiredText(formData.get("state"), "State", 120);
  const pinCode = requiredText(formData.get("pinCode"), "PIN Code", 20);
  const type = requiredText(formData.get("type"), "Customer type", 50);
  if (!Object.values(CustomerType).includes(type as CustomerType))
    throw new Error("Invalid customer type.");

  const customer = await db.$transaction(async (tx) => {
    const customerCode = await nextDocumentNumber(tx, "customer", "VFE-CUS-");
    const row = await tx.customer.create({
      data: {
        customerCode,
        type: type as CustomerType,
        name,
        primaryMobile,
        alternateMobile: optionalString(formData.get("alternateMobile")),
        email: optionalString(formData.get("email")),
        address,
        city,
        state,
        pinCode,
        gstNumber: optionalString(formData.get("gstNumber")),
        notes: optionalString(formData.get("notes")),
      },
    });
    return row;
  });
  revalidateTag("customer-options");
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const before = await db.customer.findUnique({ where: { id } });
  if (!before) throw new Error("Customer not found.");
  const type = requiredText(formData.get("type"), "Customer type", 50);
  if (!Object.values(CustomerType).includes(type as CustomerType))
    throw new Error("Invalid customer type.");
  const name = requiredText(formData.get("name"), "Customer name", 200);
  const primaryMobile = requiredText(
    formData.get("primaryMobile"),
    "Primary mobile",
    30,
  );
  const address = requiredText(formData.get("address"), "Address", 1000);
  const city = requiredText(formData.get("city"), "City", 120);
  const state = requiredText(formData.get("state"), "State", 120);
  const pinCode = requiredText(formData.get("pinCode"), "PIN Code", 20);
  await db.$transaction(async (tx) => {
    const row = await tx.customer.update({
      where: { id },
      data: {
        type: type as CustomerType,
        name,
        primaryMobile,
        alternateMobile: optionalString(formData.get("alternateMobile")),
        email: optionalString(formData.get("email")),
        address,
        city,
        state,
        pinCode,
        gstNumber: optionalString(formData.get("gstNumber")),
        notes: optionalString(formData.get("notes")),
      },
    });
  });
  revalidateTag("customer-options");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}
