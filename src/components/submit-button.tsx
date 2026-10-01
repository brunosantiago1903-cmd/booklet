"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={buttonClass(variant, className)}
      {...props}
    >
      {pending ? (pendingText ?? "Salvando…") : children}
    </button>
  );
}
