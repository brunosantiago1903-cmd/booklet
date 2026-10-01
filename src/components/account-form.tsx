"use client";

import { useActionState, useState } from "react";
import type { AccountFormState } from "@/app/(app)/contas/actions";
import { SubmitButton } from "./submit-button";
import { cx, Field, inputClass, Notice } from "./ui";

export type AccountFormDefaults = {
  id?: string;
  name: string;
  type: "checking" | "credit_card";
  institution: string;
  ownerMemberId: string;
  initialBalance: string;
  creditLimit: string;
  closingDay: string;
  dueDay: string;
};

export function AccountForm({
  action,
  defaults,
  members,
}: {
  action: (state: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  defaults: AccountFormDefaults;
  members: { id: string; display_name: string }[];
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [type, setType] = useState(defaults.type);
  const editing = !!defaults.id;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="type" value={type} />

      <fieldset disabled={editing}>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Tipo</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup">
          {(
            [
              ["checking", "Conta corrente"],
              ["credit_card", "Cartão de crédito"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={cx(
                "min-h-10 rounded-lg text-sm font-semibold disabled:opacity-70",
                type === value ? "bg-surface text-ink shadow-sm" : "text-ink-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Nome" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={defaults.name}
          placeholder={type === "credit_card" ? "Ex.: Nubank da Ana" : "Ex.: Conta conjunta Itaú"}
          className={inputClass()}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Banco" htmlFor="institution">
          <input
            id="institution"
            name="institution"
            maxLength={80}
            defaultValue={defaults.institution}
            placeholder="Ex.: Itaú"
            className={inputClass()}
          />
        </Field>
        <Field label="Titular" htmlFor="owner_member_id">
          <select id="owner_member_id" name="owner_member_id" defaultValue={defaults.ownerMemberId} className={inputClass()}>
            <option value="">Do casal</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === "credit_card" ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dia do fechamento" htmlFor="closing_day">
              <input
                id="closing_day"
                name="closing_day"
                type="number"
                min={1}
                max={31}
                required
                inputMode="numeric"
                defaultValue={defaults.closingDay}
                className={inputClass()}
              />
            </Field>
            <Field label="Dia do vencimento" htmlFor="due_day">
              <input
                id="due_day"
                name="due_day"
                type="number"
                min={1}
                max={31}
                required
                inputMode="numeric"
                defaultValue={defaults.dueDay}
                className={inputClass()}
              />
            </Field>
          </div>
          <Field label="Limite (R$)" htmlFor="credit_limit" hint="Opcional. Usado para mostrar quanto do limite está livre.">
            <input
              id="credit_limit"
              name="credit_limit"
              inputMode="decimal"
              defaultValue={defaults.creditLimit}
              placeholder="0,00"
              className={inputClass("tabular")}
            />
          </Field>
          <Field
            label="Saldo devedor inicial (R$)"
            htmlFor="initial_balance"
            hint="Use negativo para uma dívida que já existia antes do primeiro lançamento (ex.: -350,00)."
          >
            <input
              id="initial_balance"
              name="initial_balance"
              inputMode="decimal"
              defaultValue={defaults.initialBalance}
              placeholder="0,00"
              className={inputClass("tabular")}
            />
          </Field>
        </>
      ) : (
        <Field
          label="Saldo inicial (R$)"
          htmlFor="initial_balance"
          hint="Saldo da conta antes do primeiro lançamento registrado aqui."
        >
          <input
            id="initial_balance"
            name="initial_balance"
            inputMode="decimal"
            defaultValue={defaults.initialBalance}
            placeholder="0,00"
            className={inputClass("tabular")}
          />
        </Field>
      )}

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton className="w-full">{editing ? "Salvar alterações" : "Cadastrar"}</SubmitButton>
    </form>
  );
}
