import { WarrantyStatus } from "@prisma/client";

export function warrantyStatus(
  expiry: Date | null | undefined,
  serviceDate = new Date(),
) {
  if (!expiry) return WarrantyStatus.UNKNOWN;
  // A date-only warranty remains valid for the entire expiry day in India.
  const day = (value: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
  return day(serviceDate) <= day(expiry)
    ? WarrantyStatus.UNDER_WARRANTY
    : WarrantyStatus.OUT_OF_WARRANTY;
}
