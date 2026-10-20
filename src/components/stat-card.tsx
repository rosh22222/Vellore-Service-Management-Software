import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

const tones = {
  teal: {
    soft: "bg-teal-50",
    text: "text-teal-700",
  },
  blue: {
    soft: "bg-brand-soft",
    text: "text-brand-primary",
  },
  amber: {
    soft: "bg-brand-warm-soft",
    text: "text-brand-warm-ink",
  },
  emerald: {
    soft: "bg-[#F0FDF4]",
    text: "text-emerald-700",
  },
  slate: {
    soft: "bg-brand-cool/15",
    text: "text-brand-secondary",
  },
  violet: {
    soft: "bg-brand-highlight/20",
    text: "text-brand-primary",
  },
  cool: {
    soft: "bg-brand-ice",
    text: "text-brand-cool-ink",
  },
};

type StatTone = keyof typeof tones;

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "blue",
  className = "",
  href,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
  href?: string;
}) {
  const selectedTone = tones[tone];
  const body = (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium leading-5 text-brand-secondary">{label}</p>
          {icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px] ${selectedTone.soft} ${selectedTone.text}`}>
              {icon}
            </span>
          )}
        </div>
        <div className="mt-2 break-words text-[1.8rem] font-semibold leading-tight tracking-tight text-brand-ink tabular-nums">{value}</div>
        <div className="mt-2 flex items-end justify-between gap-2">
          {hint && <p className="text-[11px] leading-5 text-brand-muted">{hint}</p>}
          {href && <ArrowRight aria-hidden="true" size={15} className="ml-auto shrink-0 text-brand-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary" />}
        </div>
      </div>
    </>
  );

  const classNames = `group relative min-w-0 rounded-2xl border border-brand-border bg-white p-4 shadow-panel transition-colors duration-150 ${href ? "hover:border-brand-accent hover:bg-brand-faint/60 hover:shadow-md" : ""} ${className}`;

  return href ? (
    <Link href={href} className={classNames}>
      {body}
    </Link>
  ) : (
    <div className={classNames}>{body}</div>
  );
}

