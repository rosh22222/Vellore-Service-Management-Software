"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { requiredText } from "@/lib/format";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function assertUniqueSlug(slug: string, currentId?: string) {
  const existing = await db.brand.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing && existing.id !== currentId) {
    throw new Error("This brand already exists.");
  }
}

export async function createBrand(formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const name = requiredText(formData.get("name"), "Brand name", 120);
  const slug = slugify(name);
  if (!slug) throw new Error("Brand name is invalid.");
  await assertUniqueSlug(slug);

  await db.brand.create({
    data: {
      name,
      slug,
      isActive: true,
    },
  });

  revalidateTag("brand-options");
  revalidatePath("/brands");
  revalidatePath("/bill-details/new");
}

export async function updateBrand(id: string, formData: FormData) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const name = requiredText(formData.get("name"), "Brand name", 120);
  const slug = slugify(name);
  if (!slug) throw new Error("Brand name is invalid.");
  await assertUniqueSlug(slug, id);

  await db.brand.update({
    where: { id },
    data: {
      name,
      slug,
    },
  });

  revalidateTag("brand-options");
  revalidatePath("/brands");
  revalidatePath("/bill-details/new");
}

export async function toggleBrand(id: string) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const brand = await db.brand.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!brand) throw new Error("Brand not found.");

  await db.brand.update({
    where: { id },
    data: { isActive: !brand.isActive },
  });

  revalidateTag("brand-options");
  revalidatePath("/brands");
  revalidatePath("/bill-details/new");
}

export async function deleteBrand(id: string) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  await db.brand.delete({ where: { id } });

  revalidateTag("brand-options");
  revalidatePath("/brands");
  revalidatePath("/bill-details/new");
}
