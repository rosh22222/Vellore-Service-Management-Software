const DAY = 86_400_000;
export function dateInput(value: Date | null | undefined = new Date()) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export function dateBoundary(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const check = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== value) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}+05:30`);
}
export function businessRange(period = "month", from?: string, to?: string, now = new Date()) {
  const today = dateInput(now);
  const dayStart = dateBoundary(today)!;
  let start = dateBoundary(`${today.slice(0, 7)}-01`)!;
  let end = new Date(dayStart.getTime() + DAY - 1);
  if (period === "today") start = dayStart;
  if (period === "yesterday") { start = new Date(dayStart.getTime() - DAY); end = new Date(dayStart.getTime() - 1); }
  if (period === "week") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = new Date(dayStart.getTime() - ((weekday + 6) % 7) * DAY);
  }
  if (period === "custom") {
    const customStart = dateBoundary(from), customEnd = dateBoundary(to, true) ?? end;
    if (customStart && customStart <= customEnd) { start = customStart; end = customEnd; }
  }
  return { start, end };
}
