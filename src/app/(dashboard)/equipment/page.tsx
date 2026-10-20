import Link from "next/link";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { SearchForm } from "@/components/ui/search-form";
import { Badge } from "@/components/ui/badge";
import { date } from "@/lib/format";
import { warrantyStatus } from "@/lib/warranty";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { q = "" } = await searchParams;
  const rows = await db.customerEquipment.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { modelNumber: { contains: q, mode: "insensitive" } },
            { serialNumber: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      customer: true,
      _count: {
        select: {
          serviceRecords: true,
          complaints: {
            where: {
              status: {
                notIn: [
                  ServiceStatus.SERVICE_COMPLETED,
                  ServiceStatus.CLOSED,
                  ServiceStatus.CANCELLED,
                ],
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Customer Equipment"
        description="Every machine belongs to a customer and keeps its own complete service timeline."
        actions={
          <Link
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
            href="/equipment/new"
          >
            + Add Equipment
          </Link>
        }
      />
      <SearchForm query={q} label="Search equipment" placeholder="Search equipment, model, serial or customer..." resetHref="/equipment" />
      {rows.length ? (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Customer</th>
                  <th>Model</th>
                  <th>Serial</th>
                  <th>Installed</th>
                  <th>Warranty</th>
                  <th>Open Complaints</th>
                  <th>Services</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link className="link" href={`/equipment/${e.id}`}>
                        {e.name}
                      </Link>
                      <div className="text-xs text-brand-muted">
                        {e.equipmentCode}
                      </div>
                    </td>
                    <td>
                      <Link
                        className="link"
                        href={`/customers/${e.customerId}`}
                      >
                        {e.customer.name}
                      </Link>
                    </td>
                    <td>{e.modelNumber ?? "—"}</td>
                    <td>{e.serialNumber ?? "—"}</td>
                    <td>{date(e.installationDate)}</td>
                    <td>
                      <Badge value={warrantyStatus(e.warrantyExpiryDate)} />
                    </td>
                    <td>{e._count.complaints}</td>
                    <td>{e._count.serviceRecords}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No equipment found"
          text="Register customer equipment to begin service tracking."
        />
      )}
    </>
  );
}


