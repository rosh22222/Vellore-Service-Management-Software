import { titleCase } from "@/lib/format";

const map: Record<string, string> = {
  URGENT: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
  HIGH: "bg-brand-warm-soft text-brand-warm-ink ring-brand-warm/60",
  NORMAL: "bg-brand-faint text-brand-primary ring-brand-accent",
  LOW: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  UNASSIGNED: "bg-brand-warm-soft text-brand-warm-ink ring-brand-warm/60",
  TECHNICIAN_ASSIGNED: "bg-brand-faint text-brand-primary ring-brand-accent",
  TECHNICIAN_ACCEPTED: "bg-brand-faint text-brand-primary ring-brand-accent",
  TECHNICIAN_VISITING: "bg-brand-faint text-brand-primary ring-brand-accent",
  INSPECTION_STARTED: "bg-brand-ice/60 text-brand-cool-ink ring-brand-ice",
  PROBLEM_DIAGNOSED: "bg-brand-ice/60 text-brand-cool-ink ring-brand-ice",
  REPAIR_IN_PROGRESS: "bg-brand-faint text-brand-primary ring-brand-accent",
  WAITING_FOR_SPARE_PART: "bg-brand-warm-soft text-brand-warm-ink ring-brand-warm/60",
  WAITING_FOR_CUSTOMER_APPROVAL: "bg-brand-warm-soft text-brand-warm-ink ring-brand-warm/60",
  SERVICE_COMPLETED: "bg-[#F0FDF4] text-emerald-700 ring-[#BBF7D0]",
  CLOSED: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  CANCELLED: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
  AVAILABLE: "bg-[#F0FDF4] text-emerald-700 ring-[#BBF7D0]",
  BUSY: "bg-brand-warm-soft text-brand-warm-ink ring-brand-warm/60",
  ON_LEAVE: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  INACTIVE: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  UNDER_WARRANTY: "bg-[#F0FDF4] text-emerald-700 ring-[#BBF7D0]",
  OUT_OF_WARRANTY: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
  UNKNOWN: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  APPROVED: "bg-[#F0FDF4] text-emerald-700 ring-[#BBF7D0]",
  REJECTED: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
  CREATED: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
  SENT_TO_CUSTOMER: "bg-brand-faint text-brand-primary ring-brand-accent",
  PAID: "bg-[#F0FDF4] text-emerald-700 ring-[#BBF7D0]",
  ISSUED: "bg-brand-faint text-brand-primary ring-brand-accent",
  DRAFT: "bg-brand-cool/10 text-brand-secondary ring-brand-border",
};

const labelMap: Record<string, string> = {
  UNKNOWN: "No Warranty",
};

export function Badge({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-4 ring-1 ring-inset ${map[value] ?? "bg-brand-cool/10 text-brand-secondary ring-brand-border"}`}
    >
      {label ?? labelMap[value] ?? titleCase(value)}
    </span>
  );
}

