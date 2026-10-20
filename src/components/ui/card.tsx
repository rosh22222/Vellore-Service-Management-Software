import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-panel ${className}`}
    >
      {children}
    </div>
  );
}
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-gradient-to-r from-white to-brand-faint/65 px-5 py-4 md:px-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-brand-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-xs leading-5 text-brand-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 md:p-6 ${className}`}>{children}</div>;
}

