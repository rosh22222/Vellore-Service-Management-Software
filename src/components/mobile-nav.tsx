"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, LogOut, X } from "lucide-react";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";

export function MobileNav({
  role,
  canAssignTechnician,
}: {
  role: UserRole;
  canAssignTechnician: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const links =
    role === "TECHNICIAN"
      ? [["/jobs", "My Jobs"]]
      : [
          ["/dashboard", "Dashboard"],
          ["/customers", "Customers"],
          ["/equipment", "Equipment"],
          ["/brands", "Brands"],
          ["/bill-details", "Bill Details"],
          ["/complaints", "Complaints"],
          ["/teams", "Teams"],
          ["/service-history", "Service History"],
          ["/service-collections", "Collections"],
          ["/reports", "Reports"],
          ...(role === "ADMIN" ? [["/settings", "Settings"]] : []),
        ];
  return (
    <div className="lg:hidden">
      <button
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-brand-primary p-4 text-white shadow-md"
      >
        <Menu />
      </button>
        <dialog
          ref={dialog}
          aria-label="Main navigation"
          className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-brand-border bg-white p-5 shadow-lg backdrop:bg-brand-ink/40 backdrop:backdrop-blur-sm"
          onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        >
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-ink">Navigation</h2>
              <button type="button" autoFocus aria-label="Close navigation menu" className="rounded-lg p-3 text-brand-muted hover:bg-brand-subtle" onClick={() => dialog.current?.close()}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {links.map(([href, label]) => (
                <Link
                  onClick={() => dialog.current?.close()}
                  aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
                  className="rounded-xl border border-brand-border bg-white px-3 py-3 text-xs font-medium text-brand-secondary transition-colors hover:bg-brand-subtle aria-[current=page]:border-brand-accent aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-primary"
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-3 text-sm font-bold text-white hover:bg-brand-primary-hover"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </dialog>
    </div>
  );
}


