"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, X } from "lucide-react";

export function DismissibleErrorDialog({
  message,
  title = "Unable to complete this action",
  onClose,
}: {
  message: ReactNode;
  title?: string;
  onClose?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  useEffect(() => {
    if (!visible) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-white/90 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-[390px] rounded-2xl border border-rose-100 bg-white px-7 pb-7 pt-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close message"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition hover:border-brand-primary hover:bg-brand-soft hover:text-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-soft"
        >
          <X size={19} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <CircleAlert size={22} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-4 text-base font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <div id={descriptionId} className="mx-auto mt-2 max-w-[320px] text-sm font-medium leading-6 text-rose-700">
          {message}
        </div>
      </div>
    </div>
  );
}
