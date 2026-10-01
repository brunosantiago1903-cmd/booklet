import { addMonths, daysInMonth, invoiceFor, parseISODate, toISODate, type ISODate } from "./dates";

export type InvoiceTotals = {
  invoice_month: string;
  charges_cents: number;
  payments_cents: number;
};

export type CardSummary = {
  openInvoiceMonth: ISODate;
  openDueDate: ISODate;
  openCents: number;
  closedInvoiceMonth: ISODate;
  closedDueDate: ISODate;
  /** Quanto falta pagar da última fatura fechada (0 se quitada). */
  closedRemainingCents: number;
  closedState: "none" | "paid" | "due" | "overdue";
  limitCents: number | null;
  /** Dívida total no cartão (compras não pagas, de todas as faturas). */
  usedCents: number;
};

export function dueDateOf(invoiceMonth: ISODate, dueDay: number): ISODate {
  const { year, month } = parseISODate(invoiceMonth);
  return toISODate(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

export function summarizeCard(params: {
  closingDay: number;
  dueDay: number;
  balanceCents: number;
  creditLimitCents: number | null;
  invoices: InvoiceTotals[];
  today: ISODate;
}): CardSummary {
  const { closingDay, dueDay, today } = params;
  const open = invoiceFor(today, closingDay, dueDay);
  const closedInvoiceMonth = addMonths(open.invoiceMonth, -1);
  const byMonth = new Map(params.invoices.map((i) => [i.invoice_month, i]));

  const openTotals = byMonth.get(open.invoiceMonth);
  const closedTotals = byMonth.get(closedInvoiceMonth);
  const closedDueDate = dueDateOf(closedInvoiceMonth, dueDay);
  const closedRemainingCents = closedTotals
    ? Math.max(0, closedTotals.charges_cents - closedTotals.payments_cents)
    : 0;

  let closedState: CardSummary["closedState"] = "none";
  if (closedTotals && closedTotals.charges_cents > 0) {
    closedState = closedRemainingCents === 0 ? "paid" : today > closedDueDate ? "overdue" : "due";
  }

  return {
    openInvoiceMonth: open.invoiceMonth,
    openDueDate: open.dueDate,
    openCents: openTotals ? openTotals.charges_cents - openTotals.payments_cents : 0,
    closedInvoiceMonth,
    closedDueDate,
    closedRemainingCents,
    closedState,
    limitCents: params.creditLimitCents,
    usedCents: Math.max(0, -params.balanceCents),
  };
}
