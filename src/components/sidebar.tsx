"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Tags,
  Wrench,
  Receipt,
  IndianRupee,
  BarChart3,
  History,
  Settings,
} from "lucide-react";

const officeItems = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/customers", "Customers", Users],
  ["/equipment", "Equipment", Dumbbell],
  ["/brands", "Brands", Tags],
  ["/bill-details", "Bill Details", Receipt],
  ["/complaints", "Service Complaints", Wrench],
  ["/teams", "Teams", Users],
  ["/service-history", "Service History", History],
  ["/service-collections", "Service Collections", IndianRupee],
  ["/reports", "Reports", BarChart3],
  ["/settings", "Settings", Settings],
] as const;
const techItems = [["/jobs", "My Jobs", Wrench]] as const;

export function Sidebar({
  role,
  companyName,
  logoSrc,
  canAssignTechnician,
}: {
  role: UserRole;
  companyName: string;
  logoSrc: string;
  canAssignTechnician: boolean;
}) {
  const pathname = usePathname();
  const items =
    role === "TECHNICIAN"
      ? techItems
      : officeItems.filter(([href]) => {
          if (role === "OFFICE_STAFF" && href === "/settings")
            return false;
          return true;
        });
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-dvh w-64 flex-col border-r border-brand-border bg-brand-sidebar text-brand-ink lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Link
          href={role === "TECHNICIAN" ? "/jobs" : "/dashboard"}
          aria-label={role === "TECHNICIAN" ? "Go to my jobs" : "Go to dashboard"}
          className="flex h-16 items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary"
        >
          <Image
            src={logoSrc}
            alt={`${companyName} logo`}
            width={230}
            height={77}
            priority
            sizes="208px"
            className="h-full w-full object-contain"
          />
        </Link>
      </div>
      <div className="px-6 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-muted">Workspace</div>
      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3 [scrollbar-width:none]">
        {items.map(([href, label, Icon]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`sidebar-nav-link group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-medium leading-5 transition-colors duration-150 ${
                active
                  ? "bg-brand-soft font-semibold text-brand-primary ring-1 ring-inset ring-brand-accent/60"
                  : "text-brand-secondary hover:bg-brand-faint hover:text-brand-primary"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center transition ${
                  active
                    ? "text-brand-primary"
                    : "text-brand-muted group-hover:text-brand-primary"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2 : 1.7} />
              </span>
              {label}
              {active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-primary" />}
            </Link>
          );
        })}
      </nav>
      <div className="mx-6 mb-5 border-t border-brand-border pt-4">
        <p className="truncate rounded-xl bg-brand-soft px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-brand-primary ring-1 ring-inset ring-brand-accent/40">
          {companyName}
        </p>
      </div>
    </aside>
  );
}

