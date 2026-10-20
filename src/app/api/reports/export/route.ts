import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SummaryReportDocument } from "@/lib/pdf/report";
import { businessRange, dateBoundary } from "@/lib/business-date";

function csvCell(v: unknown) {
  const raw = String(v ?? "");
  const s = (/^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw).replaceAll('"', '""');
  return `"${s}"`;
}
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role === "TECHNICIAN")
    return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const defaultRange = businessRange("month");
  const fromText = url.searchParams.get("from");
  const toText = url.searchParams.get("to");
  const from = fromText ? (dateBoundary(fromText) ?? new Date(fromText)) : defaultRange.start;
  const to = toText ? (dateBoundary(toText, true) ?? new Date(toText)) : defaultRange.end;
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to)
    return new Response("Please select a valid date range.", { status: 400 });
  if (!["csv", "pdf"].includes(format))
    return new Response("Choose CSV or PDF format.", { status: 400 });
  const rows = await db.serviceRecord.findMany({
    where: { serviceDate: { gte: from, lte: to } },
    include: { collections: { select: { amount: true } } },
    orderBy: { serviceDate: "desc" },
  });
  if (format === "pdf") {
    const company = await db.companySetting.findUnique({
      where: { id: "company" },
    });
    const buffer = await renderToBuffer(
      SummaryReportDocument({ rows, company, from, to }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="vfe-service-report.pdf"',
      },
    });
  }
  const header = [
    "Service Number",
    "Date",
    "Customer",
    "Equipment",
    "Model",
    "Serial",
    "Complaint",
    "Problem Found",
    "Work Done",
    "Parts",
    "Technician",
    "Warranty",
    "Service Amount",
    "Collected",
    "Pending",
  ];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) => {
      const collected = r.collections.reduce(
        (sum, collection) => sum + Number(collection.amount),
        0,
      );
      const pending = Math.max(0, Number(r.charges) - collected);
      return [
        r.serviceNumber,
        r.serviceDate.toISOString(),
        r.customerNameSnapshot,
        r.equipmentNameSnapshot,
        r.modelSnapshot,
        r.serialSnapshot,
        r.complaintReported,
        r.problemFound,
        r.workDone,
        r.partsSummary,
        r.technicianNameSnapshot,
        r.warrantyStatus,
        r.charges.toString(),
        collected.toFixed(2),
        pending.toFixed(2),
      ]
        .map(csvCell)
        .join(",");
    }),
  ];
  return new Response("\ufeff" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vfe-service-report.csv"',
    },
  });
}
