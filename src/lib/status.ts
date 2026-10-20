import { ServiceStatus } from "@prisma/client";

export const serviceStatusOrder: ServiceStatus[] = [
  ServiceStatus.COMPLAINT_RECEIVED,
  ServiceStatus.UNASSIGNED,
  ServiceStatus.TECHNICIAN_ASSIGNED,
  ServiceStatus.TECHNICIAN_ACCEPTED,
  ServiceStatus.TECHNICIAN_VISITING,
  ServiceStatus.INSPECTION_STARTED,
  ServiceStatus.PROBLEM_DIAGNOSED,
  ServiceStatus.REPAIR_IN_PROGRESS,
  ServiceStatus.WAITING_FOR_SPARE_PART,
  ServiceStatus.WAITING_FOR_CUSTOMER_APPROVAL,
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];
