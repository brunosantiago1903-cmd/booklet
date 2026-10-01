"use client";

import { useActionState, useMemo, useState } from "react";
import type { TransactionFormState } from "@/app/(app)/lancamentos/actions";
import type { CategoryOption } from "@/lib/categories";
import { formatMonthBR, invoiceFor, invoicePaidOn, isISODate, monthKeyOf } from "@/lib/dates";
import { SubmitButton } from "./submit-button";
import { cx, Field, inputClass, Notice } from "./ui";

export type FormAccount = {
  id: string;
  name: string;
  type: "checking" | "credit_card";
  closing_day: number | null;
  due_day: number | null;
};

export type TransactionFormDefaults = {
  id?: string;
  kind: "expense" | "income" | "refund" | "transfer";
  accountId: string;
  toAccountId?: string;
  amount: string;
  date: string;
  description: string;
  categoryId: string;
  notes: string;
  installments: number;
  /** "YYYY-MM" ou "" (calcular). */
  invoiceMonth: string;
  receiptId?: string;
};

const KINDS = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
  { value: "refund", label: "Estorno" },
] as const;

export function TransactionForm({
  action,
  accounts,
  categories,
  defaults,
  mode,
  lockedValues = false,
  allowedKinds,
  warnings = [],
  suggestedPattern = "",
  returnTo,
  submitLabel,
}: {
  action: (state: TransactionFormState, formData: FormData) => Promise<TransactionFormState>;
  accounts: FormAccount[];
  categories: CategoryOption[];
  defaults: TransactionFormDefaults;
  mode: "create" | "edit";
  /** Lançamento importado do banco: valor, data e conta não mudam. */
  lockedValues?: boolean;
  allowedKinds?: TransactionFormDefaults["kind"][];
  warnings?: string[];
  suggestedPattern?: string;
  returnTo?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  const [kind, setKind] = useState(defaults.kind);
  const [accountId, setAccountId] = useState(defaults.accountId);
  const [toAccountId, setToAccountId] = useState(defaults.toAccountId ?? "");
  const [date, setDate] = useState(defaults.date);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [installments, setInstallments] = useState(defaults.installments);
  const [createRule, setCreateRule] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const categoryKind = kind === "income" ? "income" : "expense";
  const visibleCategories = categories.filter((c) => c.kind === categoryKind);
  const kinds = KINDS.filter((k) => !allowedKinds || allowedKinds.includes(k.value));

  // Cartão envolvido: na compra é a conta; no pagamento de fatura é o destino.
  const invoiceCard =
    kind === "transfer" ? (toAccount?.type === "credit_card" ? toAccount : null) : account?.type === "credit_card" ? account : null;
  const computedInvoice = useMemo(() => {
    if (!invoiceCard?.closing_day || !invoiceCard.due_day || !isISODate(date)) return null;
    const month =
      kind === "transfer"
        ? invoicePaidOn(date, invoiceCard.closing_day, invoiceCard.due_day)
        : invoiceFor(date, invoiceCard.closing_day, invoiceCard.due_day).invoiceMonth;
    return monthKeyOf(month);
  }, [invoiceCard, date, kind]);

  const showInstallments = mode === "create" && kind === "expense";
  const showCategory = kind !== "transfer";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.receiptId && <input type="hidden" name="receipt_id" value={defaults.receiptId} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <input type="hidden" name="kind" value={kind} />

      {warnings.length > 0 && (
        <Notice tone="warning">
          <ul className="list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Tipo</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 sm:grid-cols-4" role="radiogroup">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => {
                setKind(k.value);
                if ((k.value === "income") !== (kind === "income")) setCategoryId("");
              }}
              className={cx(
                "min-h-10 rounded-lg px-1 text-[13px] font-semibold",
                kind === k.value ? "bg-surface text-ink shadow-sm" : "text-ink-2",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Valor (R$)"
        htmlFor="amount"
        hint={lockedValues ? "Valor vindo do banco (não editável)." : showInstallments && installments > 1 ? "Valor total da compra." : undefined}
      >
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          defaultValue={defaults.amount}
          readOnly={lockedValues}
          required={!lockedValues}
          className={inputClass("tabular text-lg font-semibold")}
        />
      </Field>

      <div className={cx("grid gap-4", kind === "transfer" ? "sm:grid-cols-2" : "")}>
        <Field label={kind === "transfer" ? "De" : "Conta ou cartão"} htmlFor="account_id">
          <select
            id="account_id"
            name="account_id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={lockedValues}
            required
            className={inputClass()}
          >
            <option value="" disabled>
              Escolha…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.type === "credit_card" ? " (cartão)" : ""}
              </option>
            ))}
          </select>
          {lockedValues && <input type="hidden" name="account_id" value={accountId} />}
        </Field>
        {kind === "transfer" && mode === "create" && (
          <Field label="Para" htmlFor="to_account_id" hint="Para pagar a fatura, escolha o cartão.">
            <select
              id="to_account_id"
              name="to_account_id"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              required
              className={inputClass()}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.type === "credit_card" ? " (cartão)" : ""}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data" htmlFor="date">
          <input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            readOnly={lockedValues}
            required
            className={inputClass()}
          />
        </Field>
        {showInstallments ? (
          <Field label="Parcelas" htmlFor="installments">
            <select
              id="installments"
              name="installments"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className={inputClass()}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x`}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div />
        )}
      </div>

      {invoiceCard && (
        <Field
          label="Fatura"
          htmlFor="invoice_month"
          hint={
            computedInvoice
              ? `Deixe em branco para usar a calculada pelo fechamento: ${formatMonthBR(computedInvoice)}.`
              : undefined
          }
        >
          <input
            id="invoice_month"
            name="invoice_month"
            type="month"
            defaultValue={defaults.invoiceMonth}
            className={inputClass()}
          />
        </Field>
      )}

      <Field label="Descrição" htmlFor="description">
        <input
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={200}
          required
          autoComplete="off"
          placeholder={kind === "transfer" ? "Ex.: Pagamento da fatura" : "Ex.: Mercado"}
          className={inputClass()}
        />
      </Field>

      {showCategory && (
        <Field label="Categoria" htmlFor="category_id">
          <select
            id="category_id"
            name="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass()}
          >
            <option value="">Sem categoria</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {showCategory && categoryId && (
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="create_rule"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>Usar esta categoria sempre que a descrição tiver o trecho abaixo</span>
          </label>
          {createRule && (
            <input
              name="rule_pattern"
              defaultValue={suggestedPattern}
              aria-label="Trecho da descrição"
              required
              minLength={2}
              className={inputClass("mt-2")}
            />
          )}
        </div>
      )}

      <Field label="Observações" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes}
          rows={2}
          maxLength={1000}
          className={inputClass("py-2")}
        />
      </Field>

      {state.error && <Notice tone="error">{state.error}</Notice>}

      <SubmitButton className="w-full">{submitLabel ?? (mode === "create" ? "Salvar lançamento" : "Salvar alterações")}</SubmitButton>
    </form>
  );
}
