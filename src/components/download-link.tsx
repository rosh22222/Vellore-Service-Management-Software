"use client";
import { useRef, useState, type ReactNode } from "react";
import { startLoading } from "@/lib/loading-feedback";

export function DownloadLink({ href, children, className, preview = false }: { href: string; children: ReactNode; className?: string; preview?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  return <span className="inline-flex max-w-full flex-col gap-1">
    <a href={href} target={preview ? "_blank" : undefined} rel="noopener noreferrer" className={className} aria-busy={pending} aria-disabled={pending} onClick={async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); if (busy.current) return; busy.current = true;
      setPending(true); setError(""); const stop = startLoading();
      let popup: Window | null = null;
      try {
      popup = preview ? window.open("about:blank", "_blank") : null;
      if (popup) {
        popup.opener = null;
        popup.document.write('<!doctype html><title>Preparing report</title><style>@keyframes spin{to{transform:rotate(360deg)}}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font:16px system-ui;color:#6942ba}.loader{display:flex;align-items:center;gap:12px}.spin{width:24px;height:24px;border:3px solid #ddd6f3;border-top-color:#6942ba;border-radius:50%;animation:spin .8s linear infinite}</style><div class="loader" role="status"><span class="spin"></span>Preparing your report…</div>');
        popup.document.close();
      }
        const response = await fetch(href, { credentials: "same-origin" });
        if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to download." : "Could not prepare the file. Please try again.");
        const url = URL.createObjectURL(await response.blob());
        if (popup && !popup.closed) popup.location.replace(url);
        else {
          const link = document.createElement("a"); link.href = url;
          const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/i)?.[1];
          link.download = filename?.replace(/[\\/\r\n]/g, "_") || (response.headers.get("content-type")?.includes("pdf") ? "report.pdf" : "report.csv");
          document.body.append(link); link.click(); link.remove();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (failure) { popup?.close(); setError(failure instanceof TypeError ? "Connection interrupted. Check your internet and try again." : failure instanceof Error ? failure.message : "Download failed. Check your connection and try again."); }
      finally { busy.current = false; setPending(false); stop(); }
    }}>
      {pending ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Preparing…</> : children}
    </a>
    {error && <span role="alert" className="max-w-xs text-xs text-rose-700">{error}</span>}
  </span>;
}
