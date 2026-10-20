import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addBillDetailItemFromForm } from "@/actions/bill-detail";
import { BillProductFields } from "@/components/bill-product-fields";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { date } from "@/lib/format";
import { getCachedActiveBrands } from "@/lib/cached-lookups";

export default async function AddBillProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const { id } = await params;
  const [bill, brands] = await Promise.all([
    db.billDetail.findUnique({
      where: { id },
      include: { customer: true },
    }),
    getCachedActiveBrands(),
  ]);
  if (!bill) notFound();

  return (
    <>
      <PageHeader
        title="Add Product"
        description={`${bill.billNumber} - ${bill.customer.name} - ${date(
          bill.billDate,
        )}`}
        actions={
          <Link
            className="rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-secondary shadow-sm hover:bg-brand-subtle"
            href={`/bill-details/${bill.id}`}
          >
            Back to Bill
          </Link>
        }
      />

      <Card>
        <CardHeader
          title="Product Details"
          subtitle="Save one more product under this existing customer bill."
        />
        <CardBody>
          <ActionForm
            action={addBillDetailItemFromForm}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="billDetailId" value={bill.id} />
            <div className="md:col-span-2 xl:col-span-4">
              <BillProductFields
                brandOptions={brands.map((brand) => brand.name)}
              />
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
              <Button type="submit" loadingText="Adding product...">
                Add Product to Bill
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-secondary shadow-sm hover:bg-brand-subtle"
                href={`/bill-details/${bill.id}`}
              >
                Cancel
              </Link>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
