"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useActionPending } from "@/components/action-form";

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-brand-primary bg-brand-primary text-white shadow-[0_3px_8px_rgb(var(--color-primary)/0.14)] hover:bg-brand-primary-hover",
  secondary:
    "border border-brand-input bg-white text-brand-secondary shadow-sm hover:border-brand-accent hover:bg-brand-faint hover:text-brand-primary",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100",
  success:
    "border border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
  ghost:
    "border border-transparent bg-transparent text-brand-primary hover:bg-brand-faint",
};

export function Button({
  children,
  className = "",
  loadingText: _loadingText = "Please wait...",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loadingText?: string;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  const actionPending = useActionPending();
  const isSubmitButton = props.type !== "button" && props.type !== "reset";
  const isLoading = isSubmitButton && (pending || actionPending);

  return (
    <button
      {...props}
      disabled={props.disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:border-brand-border disabled:bg-brand-subtle disabled:text-brand-muted disabled:shadow-none ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

