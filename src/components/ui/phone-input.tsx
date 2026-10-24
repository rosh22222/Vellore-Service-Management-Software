"use client";

import type { InputEvent, InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/form";

export function PhoneInput({
  onInput,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const keepTenDigits = (event: InputEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const digits = input.value.replace(/\D/g, "").slice(0, 10);
    if (input.value !== digits) input.value = digits;
    onInput?.(event);
  };

  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete={props.autoComplete ?? "tel"}
      minLength={10}
      maxLength={10}
      pattern="[0-9]{10}"
      title="Enter exactly 10 digits"
      onInput={keepTenDigits}
    />
  );
}
