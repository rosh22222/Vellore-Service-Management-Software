import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export function SearchForm({
  query,
  placeholder,
  label,
  resetHref,
  hiddenFields = {},
}: {
  query: string;
  placeholder: string;
  label: string;
  resetHref: string;
  hiddenFields?: Record<string, string | undefined>;
}) {
  return (
    <form role="search" className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-border bg-white p-3 shadow-panel">
      {Object.entries(hiddenFields).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className="relative min-w-[160px] flex-1">
        <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" />
        <Input name="q" type="search" defaultValue={query} aria-label={label} placeholder={placeholder} className="pl-10" />
      </div>
      <Button type="submit">Search</Button>
      {query && <Link href={resetHref} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-subtle hover:text-brand-primary">Clear</Link>}
    </form>
  );
}
