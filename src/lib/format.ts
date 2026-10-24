export function money(
  value: number | string | { toString(): string } | null | undefined,
) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function date(
  value: Date | string | null | undefined,
  withTime = false,
) {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat(
    "en-IN",
    withTime
      ? {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" },
  ).format(d);
}

export function titleCase(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function n(value: FormDataEntryValue | null) {
  return Number(value || 0);
}

export function optionalString(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export function phoneNumber(
  value: FormDataEntryValue | null,
  label: string,
  required = true,
) {
  const phone = String(value ?? "").trim();
  if (!phone) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (!/^\d{10}$/.test(phone))
    throw new Error(`${label} must contain exactly 10 digits.`);
  return phone;
}

export function indianPinCode(
  value: FormDataEntryValue | null,
  label = "PIN Code",
) {
  const pin = String(value ?? "").trim();
  if (!pin) throw new Error(`${label} is required.`);
  if (!/^\d{6}$/.test(pin))
    throw new Error(`${label} must contain exactly 6 digits.`);
  return pin;
}

export function optionalDate(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("A supplied date is invalid.");
  const check = new Date(`${s}T00:00:00Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== s)
    throw new Error("A supplied date is invalid.");
  const parsed = new Date(`${s}T00:00:00`);
  if (Number.isNaN(parsed.getTime()))
    throw new Error("A supplied date is invalid.");
  return parsed;
}

export function requiredText(
  value: FormDataEntryValue | null,
  label: string,
  maxLength = 5000,
) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

export function nonNegativeNumber(
  value: FormDataEntryValue | null,
  label: string,
) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${label} must be a valid non-negative number.`);
  return parsed;
}
