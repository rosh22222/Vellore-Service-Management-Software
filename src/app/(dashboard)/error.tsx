"use client";

import { useEffect } from "react";
import { isChunkLoadError } from "@/lib/client-errors";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const needsReload = isChunkLoadError(error);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-8 text-center shadow-panel">
      <div className="text-sm font-bold uppercase tracking-wider text-rose-600">
        {needsReload ? "Page update detected" : "Action could not be completed"}
      </div>
      <h1 className="mt-2 text-2xl font-bold text-brand-ink">
        {needsReload ? "Reload to open this page" : "Please review the entered information"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-brand-secondary">
        {needsReload
          ? "The app was updated or restarted while this tab was open. Reload to get the latest page files."
          : error.message ||
          "An unexpected error occurred. No completed service history was changed."}
      </p>
      <button
        onClick={() => needsReload ? window.location.reload() : reset()}
        className="mt-6 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white"
      >
        {needsReload ? "Reload page" : "Try again"}
      </button>
    </div>
  );
}


