"use client";

import React, { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export function LoginPasswordInput({ id, disabled, className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number | null; end: number | null } | null>(null);

  function toggleVisibility() {
    const input = inputRef.current;
    if (!input || disabled) return;
    selection.current = { start: input.selectionStart, end: input.selectionEnd };
    setVisible((previous) => !previous);
  }

  useLayoutEffect(() => {
    const input = inputRef.current;
    const previousSelection = selection.current;
    if (!input || !previousSelection) return;
    input.focus({ preventScroll: true });
    if (previousSelection.start !== null && previousSelection.end !== null) {
      input.setSelectionRange(previousSelection.start, previousSelection.end);
    }
    selection.current = null;
  }, [visible]);

  return (
    <div className="relative isolate">
      <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[14px] bg-brand-faint text-brand-primary">
        <LockKeyhole size={19} strokeWidth={1.8} />
      </span>
      <input
        {...props}
        ref={inputRef}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`login-input login-password relative z-0 w-full min-w-0 border bg-white py-2.5 text-brand-ink outline-none transition-colors placeholder:text-brand-muted hover:border-brand-cool ${className}`}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
        aria-pressed={visible}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleVisibility}
        className="pointer-events-auto absolute right-2.5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-brand-muted transition-colors hover:bg-brand-faint hover:text-brand-primary disabled:cursor-wait disabled:opacity-50"
      >
        {visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
      </button>
    </div>
  );
}
