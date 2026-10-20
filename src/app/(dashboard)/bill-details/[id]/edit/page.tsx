import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
// Compatibility redirect only; editing lives in the Bill Details register.
export default async function OldBillEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  redirect(`/bill-details?editBill=${encodeURIComponent(id)}`);
}
