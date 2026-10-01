import type { TablesInsert } from "./database.types";
import { addMonths, invoiceFor, invoicePaidOn, type ISODate } from "./dates";
import { buildInstallmentPlan } from "./installments";

/** O que a pessoa escolhe no formulário. "refund" = estorno/devolução (abate despesa). */
export type TransactionKind = "expense" | "income" | "refund" | "transfer";

export type AccountForBuild = {
  id: string;
  type: "checking" | "credit_card";
  closing_day: number | null;
  due_day: number | null;
};

export type NewTransactionInput = {
  kind: TransactionKind;
  account: AccountForBuild;
  toAccount?: AccountForBuild | null;
  /** Valor positivo em centavos. */
  amountCents: number;
  date: ISODate;
  description: string;
  categoryId: string | null;
  notes: string | null;
  installments: number;
  /** Fatura escolhida manualmente (primeiro dia do mês), só para cartão. */
  invoiceMonth?: ISODate | null;
  source: "manual" | "receipt";
  receiptId: string | null;
  createdBy: string | null;
  newId: () => string;
};

type Row = TablesInsert<"transactions">;

function cardInvoice(account: AccountForBuild, date: ISODate): ISODate | null {
  if (account.type !== "credit_card" || !account.closing_day || !account.due_day) return null;
  return invoiceFor(date, account.closing_day, account.due_day).invoiceMonth;
}

export function kindToType(kind: TransactionKind): "income" | "expense" | "transfer" {
  if (kind === "transfer") return "transfer";
  return kind === "income" ? "income" : "expense";
}

export function signedAmount(kind: Exclude<TransactionKind, "transfer">, amountCents: number): number {
  return kind === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);
}

/** Tipo exibido no formulário a partir de um lançamento salvo. */
export function kindOf(tx: { type: "income" | "expense" | "transfer"; amount_cents: number }): TransactionKind {
  if (tx.type === "transfer") return "transfer";
  if (tx.type === "income") return "income";
  return tx.amount_cents > 0 ? "refund" : "expense";
}

/** Monta as linhas a inserir: simples, parcelada ou transferência (duas pernas). */
export function buildNewTransactionRows(input: NewTransactionInput): Row[] {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  const description = input.description.trim();
  if (!description) throw new Error("Informe uma descrição.");

  const common = {
    description,
    notes: input.notes?.trim() || null,
    source: input.source,
    receipt_id: input.receiptId,
    created_by: input.createdBy,
    status: "cleared" as const,
  };

  if (input.kind === "transfer") {
    const to = input.toAccount;
    if (!to) throw new Error("Escolha a conta de destino.");
    if (to.id === input.account.id) throw new Error("A conta de destino precisa ser diferente da origem.");
    const group = input.newId();
    const toInvoice =
      to.type === "credit_card" && to.closing_day && to.due_day
        ? (input.invoiceMonth ?? invoicePaidOn(input.date, to.closing_day, to.due_day))
        : null;
    return [
      {
        ...common,
        account_id: input.account.id,
        type: "transfer",
        amount_cents: -input.amountCents,
        date: input.date,
        invoice_month: cardInvoice(input.account, input.date),
        transfer_group_id: group,
        category_id: null,
      },
      {
        ...common,
        account_id: to.id,
        type: "transfer",
        amount_cents: input.amountCents,
        date: input.date,
        invoice_month: toInvoice,
        transfer_group_id: group,
        category_id: null,
        // O comprovante fica só na perna de origem.
        receipt_id: null,
      },
    ];
  }

  const type = kindToType(input.kind);
  const categoryFields = {
    category_id: input.categoryId,
    category_source: input.categoryId ? ("user" as const) : null,
  };
  const isCard = input.account.type === "credit_card" && !!input.account.closing_day && !!input.account.due_day;
  const installments = input.kind === "expense" ? Math.max(1, Math.floor(input.installments || 1)) : 1;

  if (installments > 1) {
    const plan = buildInstallmentPlan({
      totalCents: input.amountCents,
      count: installments,
      purchaseDate: input.date,
      card: isCard ? { closingDay: input.account.closing_day!, dueDay: input.account.due_day! } : null,
    });
    const group = input.newId();
    const firstInvoiceOverride = isCard ? input.invoiceMonth : null;
    return plan.map((item, index) => ({
      ...common,
      ...categoryFields,
      account_id: input.account.id,
      type,
      amount_cents: -item.amountCents,
      date: item.date,
      invoice_month:
        firstInvoiceOverride && item.invoiceMonth
          ? addMonths(firstInvoiceOverride, index)
          : item.invoiceMonth,
      installment_group_id: group,
      installment_number: item.number,
      installment_total: item.total,
      // Só a primeira parcela leva o comprovante (evita duplicar o vínculo).
      receipt_id: index === 0 ? input.receiptId : null,
    }));
  }

  return [
    {
      ...common,
      ...categoryFields,
      account_id: input.account.id,
      type,
      amount_cents: signedAmount(input.kind, input.amountCents),
      date: input.date,
      invoice_month: isCard ? (input.invoiceMonth ?? cardInvoice(input.account, input.date)) : null,
    },
  ];
}

