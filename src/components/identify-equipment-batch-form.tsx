"use client";

import { registerAndLinkVisitEquipmentFromForm } from "@/actions/complaint";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { VisitEquipmentEntryList } from "@/components/visit-equipment-entry-list";

type BrandOption = { name: string };

export function IdentifyEquipmentBatchForm({
  complaintId,
  brands,
  initialProblem,
}: {
  complaintId: string;
  brands: BrandOption[];
  initialProblem: string;
}) {
  return (
    <ActionForm
      action={registerAndLinkVisitEquipmentFromForm}
      className="space-y-4"
    >
      <input type="hidden" name="complaintId" value={complaintId} />
      <VisitEquipmentEntryList
        brands={brands}
        initialProblem={initialProblem}
      />
      <div className="flex justify-end border-t border-brand-border pt-4">
        <Button type="submit" className="w-full sm:w-auto">
          Register &amp; Link Equipment
        </Button>
      </div>
    </ActionForm>
  );
}
