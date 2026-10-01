"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "./submit-button";
import { cx } from "./ui";

type State = { error: string | null; ok?: string };

/** Formulário curto (uma linha) com mensagem de erro/sucesso abaixo. */
export function InlineForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  return (
    <form action={formAction} className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-stretch gap-2">
        {children}
        <SubmitButton variant="secondary" pendingText="…" className="shrink-0 px-3">
          {submitLabel}
        </SubmitButton>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-critical-text">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-xs text-good-text">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
