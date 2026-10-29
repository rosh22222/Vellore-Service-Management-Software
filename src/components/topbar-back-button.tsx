"use client";

import { ArrowLeft } from "lucide-react";

export function TopbarBackButton() {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/dashboard");
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-brand-accent/70 bg-brand-faint px-3 text-xs font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    >
      <ArrowLeft size={17} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
