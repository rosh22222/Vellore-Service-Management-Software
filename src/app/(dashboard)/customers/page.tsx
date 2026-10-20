import Link from "next/link";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { SearchForm } from "@/components/ui/search-form";
import { titleCase, date } from "@/lib/format";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { q = "" } = await searchParams;
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { primaryMobile: { contains: q } },
            { customerCode: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: { equipment: true, complaints: true, serviceRecords: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer profiles, equipment ownership, open complaints and permanent service history."
        actions={
          <Link
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
            href="/customers/new"
          >
            + Add Customer
          </Link>
        }
      />
      <SearchForm query={q} label="Search customers" placeholder="Search customer, phone, code or city..." resetHref="/customers" />
      {customers.length ? (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>Equipment</th>
                  <th>Complaints</th>
                  <th>Services</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="link">
                        {c.name}
                      </Link>
                      <div className="text-xs text-brand-muted">
                        {c.customerCode}
                      </div>
                    </td>
                    <td>{titleCase(c.type)}</td>
                    <td>{c.primaryMobile}</td>
                    <td>{c.city}</td>
                    <td>{c._count.equipment}</td>
                    <td>{c._count.complaints}</td>
                    <td>{c._count.serviceRecords}</td>
                    <td>{date(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No customers found"
          text="Add your first customer or change the search."
        />
      )}
    </>
  );
}


