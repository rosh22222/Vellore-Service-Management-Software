import { renderToBuffer } from "@react-pdf/renderer";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ServiceReportDocument } from "@/lib/pdf/service-report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const [record, company] = await Promise.all([
    db.serviceRecord.findUnique({
      where: { id },
      include: {
        complaint: true,
        collections: { select: { amount: true } },
      },
    }),
    db.companySetting.findUnique({ where: { id: "company" } }),
  ]);
  if (!record) return new Response("Not found", { status: 404 });

  if (user.role === "TECHNICIAN") {
    const hasActiveEquipmentJob = record.equipmentId
      ? await db.serviceComplaint.count({
          where: {
            currentTechnicianId: user.technicianId ?? "__none__",
            equipmentId: record.equipmentId,
            status: {
              notIn: [
                ServiceStatus.SERVICE_COMPLETED,
                ServiceStatus.CLOSED,
                ServiceStatus.CANCELLED,
              ],
            },
          },
        })
      : 0;
    if (record.technicianId !== user.technicianId && !hasActiveEquipmentJob)
      return new Response("Forbidden", { status: 403 });
  }

  const buffer = await renderToBuffer(
    ServiceReportDocument({ record, company }),
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${record.serviceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
