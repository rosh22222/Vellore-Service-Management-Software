import type { Session } from "next-auth";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, FilePlus2, Wrench } from "lucide-react";
import { TopbarLogoutButton } from "@/components/topbar-logout-button";
import { getBrandAssetSrc } from "@/lib/brand-assets";

export function Topbar({ user }: { user: Session["user"] }) {
  const initial =
    user.role === "ADMIN"
      ? "V"
      : (user.name?.trim()?.charAt(0) || "V").toUpperCase();
  const displayName = user.role === "ADMIN" ? "D SATHYAN" : user.name;
  const avatarSrc = user.role === "ADMIN" ? getBrandAssetSrc("avatar.png") : null;
  const today = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center gap-3 border-b border-brand-border bg-white/95 px-4 py-3 backdrop-blur-md sm:flex-nowrap md:px-6 xl:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-brand-soft text-lg font-semibold text-brand-primary ring-2 ring-brand-accent/70">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt={`${displayName} profile photo`}
              fill
              priority
              sizes="48px"
              className="object-cover object-[center_35%]"
            />
          ) : initial}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-5 text-brand-muted">
            Welcome back,
          </p>
          <p className="truncate text-lg font-semibold leading-6 tracking-tight text-brand-ink md:text-xl">
            {displayName}
          </p>
        </div>
      </div>

      <div className="ml-auto flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
        <p className="mr-1 hidden items-center gap-2 rounded-full border border-brand-warm/40 bg-brand-warm-soft/65 px-3 py-2 text-[11px] font-medium text-brand-warm-ink xl:flex"><CalendarDays size={14} aria-hidden="true" />{today}</p>
        {(user.role === "ADMIN" || user.role === "OFFICE_STAFF") && <Link href="/complaints/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-accent bg-brand-faint px-3 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-soft md:px-4"><Wrench size={17} aria-hidden="true" />New Complaint</Link>}
        {(user.role === "ADMIN" || user.role === "OFFICE_STAFF") && (
          <Link
            href="/bill-details/new"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-primary bg-brand-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary md:px-4"
          >
            <FilePlus2 size={17} aria-hidden="true" />
            <span>Add Bills</span>
          </Link>
        )}
        <TopbarLogoutButton />
      </div>
    </header>
  );
}

