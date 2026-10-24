"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useActionPending } from "@/components/action-form";

export function ConfirmSubmitButton({
  children,
  message,
  className = "",
  loadingText: _loadingText = "Please wait...",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  message: string;
  loadingText?: string;
}) {
  const status = useFormStatus();
  const actionPending = useActionPending();
  const pending = status.pending || actionPending;
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const confirm = () => {
    const form = formRef.current;
    setOpen(false);
    requestAnimationFrame(() => form?.requestSubmit());
  };

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={props.disabled || pending}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented || pending) return;
          formRef.current = event.currentTarget.form;
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {children}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#ded9d3]/75 p-4 backdrop-blur-[2px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="relative w-full max-w-[360px] rounded-xl border border-slate-200/80 bg-white px-7 pb-6 pt-8 text-center shadow-[0_18px_55px_rgba(15,23,42,0.16)]"
              >
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close confirmation"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={15} aria-hidden="true" />
                </button>
                <h2 id={titleId} className="text-base font-bold tracking-tight text-slate-900">
                  Are you sure?
                </h2>
                <p id={descriptionId} className="mx-auto mt-2 max-w-[290px] text-xs leading-5 text-slate-500">
                  {message}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    ref={cancelRef}
                    type="button"
                    onClick={close}
                    className="min-h-10 rounded-lg border border-slate-400 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
