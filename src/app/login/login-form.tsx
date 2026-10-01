"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass, Notice } from "@/components/ui";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, { error: null, email: "" });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          className={inputClass()}
        />
      </Field>
      <Field label="Senha" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass()}
        />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton pendingText="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
