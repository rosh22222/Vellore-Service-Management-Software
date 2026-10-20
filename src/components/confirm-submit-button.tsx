"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useActionPending } from "@/components/action-form";

export function ConfirmSubmitButton({
  children,
  message,
  className = "",
  loadingText = "Please wait...",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  message: string;
  loadingText?: string;
}) {
  const status = useFormStatus();
  const actionPending = useActionPending();
  const pending = status.pending || actionPending;

  return (
    <button
      {...props}
      type="submit"
      disabled={props.disabled || pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {pending ? loadingText : children}
    </button>
  );
}
