import { addMonths, APP_TIME_ZONE, dateInTimeZone, invoiceFor, type ISODate } from "./dates";
import { toCents } from "./money";
import { looksLikeCardBillPayment, looksLikeRefund } from "./rules";

/** Campos da Pluggy usados aqui (subconjunto de `Transaction` do pluggy-sdk). */
export type PluggyTransactionLike = {
  id: string;
  date: Date | string;
  description: string;
  descriptionRaw?: string | null;
  type: "DEBIT" | "CREDIT";
  amount: number;
  status?: "PENDING" | "POSTED" | string;
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
    purchaseDate?: Date | string;
    billId?: string;
    billForecastDate?: string;
  } | null;
};

/** Campos da Pluggy usados aqui (subconjunto de `Account` do pluggy-sdk). */
export type PluggyAccountLike = {
  id: string;
  type: "BANK" | "CREDIT" | string;
  subtype?: string | null;
  name: string;
  marketingName?: string | null;
  creditData?: {
    balanceCloseDate?: Date | string | null;
    balanceDueDate?: Date | string | null;
    creditLimit?: number | null;
  } | null;
};

export type ImportedTransactionDraft = {
  externalId: string;
  amountCents: number;
  date: ISODate;
  description: string;
  originalDescription: string;
  status: "pending" | "cleared";
  type: "income" | "expense" | "transfer";
  invoiceMonth: ISODate | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
};

/**
 * Converte a data da Pluggy em data de calendário. Datas "puras" chegam como meia-noite UTC
 * e são usadas como estão; instantes com horário são convertidos para o fuso de São Paulo.
 */
export function pluggyDateToISO(value: Date | string): ISODate {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error(`Data inválida da Pluggy: ${String(value)}`);
  const isMidnightUtc =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  return isMidnightUtc ? date.toISOString().slice(0, 10) : dateInTimeZone(date, APP_TIME_ZONE);
}

export function mapPluggyTransaction(
  tx: PluggyTransactionLike,
  ctx: {
    accountType: "checking" | "credit_card";
    closingDay: number | null;
    dueDay: number | null;
    /** billId → primeiro dia do mês de vencimento da fatura. */
    billInvoiceMonths: ReadonlyMap<string, ISODate>;
  },
): ImportedTransactionDraft {
  // `type` é a fonte da verdade para o sentido do dinheiro (DEBIT = saída).
  const amountCents = (tx.type === "DEBIT" ? -1 : 1) * Math.abs(toCents(tx.amount));
  const date = pluggyDateToISO(tx.date);
  const description = (tx.description || tx.descriptionRaw || "Lançamento do banco").replace(/\s+/g, " ").trim();
  const meta = tx.creditCardMetadata ?? null;

  let type: ImportedTransactionDraft["type"];
  if (looksLikeCardBillPayment({ description, accountType: ctx.accountType, amountCents })) {
    type = "transfer";
  } else if (amountCents < 0) {
    type = "expense";
  } else if (ctx.accountType === "credit_card" && looksLikeRefund(description)) {
    // Estorno no cartão: despesa com valor positivo, abate o gasto da categoria.
    type = "expense";
  } else {
    type = "income";
  }

  let invoiceMonth: ISODate | null = null;
  if (ctx.accountType === "credit_card") {
    const fromBill = meta?.billId ? ctx.billInvoiceMonths.get(meta.billId) : undefined;
    if (fromBill) {
      invoiceMonth = fromBill;
    } else if (meta?.billForecastDate && /^\d{4}-\d{2}$/.test(meta.billForecastDate)) {
      // Período previsto da fatura (YYYY-MM), tratado como mês de vencimento.
      invoiceMonth = `${meta.billForecastDate}-01`;
    } else if (ctx.closingDay && ctx.dueDay) {
      invoiceMonth = invoiceFor(date, ctx.closingDay, ctx.dueDay).invoiceMonth;
      const installment = meta?.installmentNumber ?? 1;
      if (installment > 1 && meta?.purchaseDate && pluggyDateToISO(meta.purchaseDate) === date) {
        // Parcela futura datada pela compra original: avança para a fatura da parcela.
        invoiceMonth = addMonths(invoiceMonth, installment - 1);
      }
    }
  }

  const total = meta?.totalInstallments ?? null;
  const number = meta?.installmentNumber ?? null;
  const hasInstallments = total !== null && number !== null && total > 1 && number >= 1 && number <= total;

  return {
    externalId: tx.id,
    amountCents,
    date,
    description,
    originalDescription: tx.descriptionRaw?.trim() || description,
    status: tx.status === "PENDING" ? "pending" : "cleared",
    type,
    invoiceMonth,
    installmentNumber: hasInstallments ? number : null,
    installmentTotal: hasInstallments ? total : null,
  };
}

export type ImportedAccountDraft = {
  name: string;
  type: "checking" | "credit_card";
  closingDay: number | null;
  dueDay: number | null;
  creditLimitCents: number | null;
  /** true quando os dias do cartão não vieram do banco e precisam ser conferidos. */
  needsReview: boolean;
};

function dayOfMonth(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  try {
    return Number(pluggyDateToISO(value).slice(8, 10));
  } catch {
    return null;
  }
}

export function mapPluggyAccount(account: PluggyAccountLike): ImportedAccountDraft {
  const name = (account.marketingName || account.name || "Conta").trim();
  if (account.type !== "CREDIT") {
    return { name, type: "checking", closingDay: null, dueDay: null, creditLimitCents: null, needsReview: false };
  }
  const closingDay = dayOfMonth(account.creditData?.balanceCloseDate);
  const dueDay = dayOfMonth(account.creditData?.balanceDueDate);
  const limit = account.creditData?.creditLimit;
  return {
    name,
    type: "credit_card",
    closingDay: closingDay ?? 1,
    dueDay: dueDay ?? 10,
    creditLimitCents: typeof limit === "number" ? toCents(limit) : null,
    needsReview: closingDay === null || dueDay === null,
  };
}
