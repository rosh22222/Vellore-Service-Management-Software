"use client";

import type { InputEvent, InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/form";

export function PinCodeInput({
  onInput,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const keepSixDigits = (event: InputEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const digits = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value !== digits) input.value = digits;
    onInput?.(event);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete={props.autoComplete ?? "postal-code"}
      minLength={6}
      maxLength={6}
      pattern="[0-9]{6}"
      title="Enter exactly 6 digits"
      onInput={keepSixDigits}
    />
  );
}
