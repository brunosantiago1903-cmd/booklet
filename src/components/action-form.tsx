"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "./submit-button";
import { cx, Notice } from "./ui";

type State = { error: string | null; ok?: string };

/** Formulário com feedback de sucesso/erro de um Server Action que devolve estado. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingText,
  variant = "primary",
  className,
  encType,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children?: ReactNode;
  submitLabel: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction] = useActionState(action, { error: null });
  return (
    <form action={formAction} encType={encType} className={cx("flex flex-col gap-3", className)}>
      {children}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <SubmitButton variant={variant} pendingText={pendingText}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
