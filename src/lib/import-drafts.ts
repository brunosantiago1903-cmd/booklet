import { invoiceFor, type ISODate } from "./dates";
import type { OfxStatement } from "./ofx";
import { looksLikeCardBillPayment, looksLikeRefund } from "./rules";

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
 * Tipo de um lançamento vindo do banco:
 * pagamento de fatura → transferência; saída → despesa; estorno no cartão → despesa positiva;
 * demais entradas → receita.
 */
export function classifyImported(params: {
  description: string;
  accountType: "checking" | "credit_card";
  amountCents: number;
}): ImportedTransactionDraft["type"] {
  if (looksLikeCardBillPayment(params)) return "transfer";
  if (params.amountCents < 0) return "expense";
  if (params.accountType === "credit_card" && looksLikeRefund(params.description)) return "expense";
  return "income";
}

export function ofxToDrafts(
  statement: OfxStatement,
  account: { type: "checking" | "credit_card"; closing_day: number | null; due_day: number | null },
): ImportedTransactionDraft[] {
  return statement.transactions.map((tx) => ({
    externalId: tx.externalId,
    amountCents: tx.amountCents,
    date: tx.date,
    description: tx.description,
    originalDescription: tx.description,
    status: "cleared",
    type: classifyImported({ description: tx.description, accountType: account.type, amountCents: tx.amountCents }),
    invoiceMonth:
      account.type === "credit_card" && account.closing_day && account.due_day
        ? invoiceFor(tx.date, account.closing_day, account.due_day).invoiceMonth
        : null,
    installmentNumber: null,
    installmentTotal: null,
  }));
}
