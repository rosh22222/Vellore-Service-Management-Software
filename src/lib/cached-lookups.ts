import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// Authorization remains database-backed, while a short cache avoids paying a
// remote Supabase round trip for every click in the same working session.
export const getCachedAuthorizationUser = unstable_cache(
  async (id: string) =>
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canAssignTechnician: true,
        canGenerateBills: true,
        technician: { select: { id: true, isActive: true } },
      },
    }),
  ["authorization-user-v1"],
  { revalidate: 30, tags: ["authorization-users"] },
);

// The sidebar needs only this stable identity field. Settings updates
// explicitly invalidate the tag, so normal navigation avoids another query.
export const getCachedCompanyIdentity = unstable_cache(
  async () =>
    db.companySetting.findUnique({
      where: { id: "company" },
      select: { companyName: true },
    }),
  ["company-identity-v1"],
  { revalidate: 60 * 60, tags: ["company-settings"] },
);

// Form dropdowns are read on many routes but change infrequently. Keeping the
// full option shape here lets those routes share one cached Supabase response.
// The corresponding server actions invalidate these tags immediately after a
// create/update/delete, so users never need to wait for the time limit.
export const getCachedCustomerOptions = unstable_cache(
  async () =>
    db.customer.findMany({
      select: {
        id: true,
        name: true,
        primaryMobile: true,
        address: true,
        city: true,
      },
      orderBy: { name: "asc" },
      take: 1000,
    }),
  ["customer-options-v1"],
  { revalidate: 5 * 60, tags: ["customer-options"] },
);

export const getCachedEquipmentOptions = unstable_cache(
  async () =>
    db.customerEquipment.findMany({
      select: {
        id: true,
        customerId: true,
        equipmentCode: true,
        name: true,
        modelNumber: true,
        serialNumber: true,
      },
      orderBy: [{ name: "asc" }, { modelNumber: "asc" }],
      take: 2000,
    }),
  ["equipment-options-v1"],
  { revalidate: 5 * 60, tags: ["equipment-options"] },
);

export const getCachedTechnicianOptions = unstable_cache(
  async () =>
    db.technician.findMany({
      where: { isActive: true },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
  ["technician-options-v1"],
  { revalidate: 5 * 60, tags: ["technician-options"] },
);

export const getCachedActiveBrands = unstable_cache(
  async () =>
    db.brand.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ["active-brand-options-v1"],
  { revalidate: 5 * 60, tags: ["brand-options"] },
);
