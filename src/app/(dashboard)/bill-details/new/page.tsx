import Link from "next/link";
import { CustomerType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { BillDetailForm } from "@/components/bill-detail-form";
import { suggestedInvoiceNumber as suggestInvoiceNumber } from "@/lib/invoice-number";
import {
  getCachedActiveBrands,
  getCachedCustomerOptions,
} from "@/lib/cached-lookups";

export default async function NewBillDetailPage() {
  await requireRoles(["ADMIN", "OFFICE_STAFF"]);

  const [customers, brands, suggestedInvoiceNumber] = await Promise.all([
    getCachedCustomerOptions(),
    getCachedActiveBrands(),
    suggestInvoiceNumber(db),
  ]);

  return (
    <>
      <PageHeader
        title="New Bill Details"
        description="Save customer, product and warranty details from an already-issued bill."
        actions={
          <>
            <Link
              href="/bill-details"
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Back to Bill Details
            </Link>
            <Link
              href="/brands"
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Manage Brands
            </Link>
          </>
        }
      />

      <Card className="border-brand-border shadow-sm">
        <CardBody>
          <BillDetailForm
            customers={customers}
            customerTypes={Object.values(CustomerType)}
            initialBillNumber={suggestedInvoiceNumber}
            brandOptions={brands.map((brand) => brand.name)}
          />
        </CardBody>
      </Card>
    </>
  );
}

