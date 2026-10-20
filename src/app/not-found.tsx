import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="text-xs font-semibold uppercase tracking-[.16em] text-brand-primary">
          404
        </div>
        <h1 className="mt-3 text-3xl font-bold text-brand-ink">
          Record not found
        </h1>
        <p className="mt-3 text-brand-muted">
          The record may not exist or your account may not have permission to
          view it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}


