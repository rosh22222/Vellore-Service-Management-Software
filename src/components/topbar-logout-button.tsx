"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { startLoading } from "@/lib/loading-feedback";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

export function TopbarLogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="relative">
    <button
      disabled={pending}
      aria-busy={pending}
      onClick={async () => { setPending(true); setError(""); const stop = startLoading(); try { await signOut({ callbackUrl: "/login" }); } catch { setError("Could not log out. Check your connection and try again."); } finally { stop(); setPending(false); } }}
      title="Log out"
      aria-label="Log out"
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-xs font-semibold text-brand-secondary transition-colors hover:border-brand-accent hover:bg-brand-soft hover:text-brand-primary md:px-4"
    >
      {pending ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <LogOut size={17} />}
      <span>{pending ? "Logging out…" : "Logout"}</span>
    </button>
    {error && <DismissibleErrorDialog message={error} onClose={() => setError("")} />}
    </div>
  );
}

