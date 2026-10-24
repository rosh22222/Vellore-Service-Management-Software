import { ComplaintPriority, ComplaintSource, CustomerType } from "@prisma/client";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { ComplaintForm } from "@/components/complaint-form";
import {
  getCachedComplaintCustomerOptions,
  getCachedEquipmentOptions,
  getCachedTechnicianOptions,
} from "@/lib/cached-lookups";

export default async function NewComplaintPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; equipmentId?: string }>;
}) {
  const user = await requireRoles(["ADMIN", "OFFICE_STAFF"]);
  const canAssign = user.role === "ADMIN" || user.canAssignTechnician;
  const { customerId, equipmentId } = await searchParams;
  const [customers, equipment, technicianOptions] = await Promise.all([
    getCachedComplaintCustomerOptions(),
    getCachedEquipmentOptions(),
    canAssign ? getCachedTechnicianOptions() : Promise.resolve([]),
  ]);
  const technicians = technicianOptions
    .filter((technician) => !["INACTIVE", "ON_LEAVE"].includes(technician.status))
    .map(({ id, name }) => ({ id, name }));
  return (
    <>
      <PageHeader
        title="New Service Complaint"
        description="Register a customer problem and choose a technician now or assign later."
      />
      <Card>
        <CardBody>
          <ComplaintForm
            customers={customers}
            equipment={equipment}
            customerTypes={Object.values(CustomerType)}
            initialCustomerId={customerId}
            initialEquipmentId={equipmentId}
            priorities={Object.values(ComplaintPriority)}
            sources={Object.values(ComplaintSource)}
            technicians={technicians}
            canAssign={canAssign}
          />
        </CardBody>
      </Card>
    </>
  );
}
