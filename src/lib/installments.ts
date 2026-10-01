import { addMonths, invoiceFor, type ISODate } from "./dates";

/**
 * Divide um total (centavos, positivo) em `count` parcelas.
 * A diferença de centavos vai para a primeira parcela: R$ 100 em 3x = 33,34 + 33,33 + 33,33.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error("O total precisa ser um inteiro positivo em centavos.");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("O número de parcelas precisa ser um inteiro maior que zero.");
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

export type InstallmentPlanItem = {
  number: number;
  total: number;
  amountCents: number;
  date: ISODate;
  invoiceMonth: ISODate | null;
};

/**
 * Gera as parcelas de uma compra. Para cartão, cada parcela cai na fatura seguinte à anterior.
 * Para conta corrente (carnê, por exemplo), só a data avança mês a mês.
 */
export function buildInstallmentPlan(params: {
  totalCents: number;
  count: number;
  purchaseDate: ISODate;
  card?: { closingDay: number; dueDay: number } | null;
}): InstallmentPlanItem[] {
  const { totalCents, count, purchaseDate, card } = params;
  const amounts = splitInstallments(totalCents, count);
  const firstInvoice = card ? invoiceFor(purchaseDate, card.closingDay, card.dueDay).invoiceMonth : null;

  return amounts.map((amountCents, i) => ({
    number: i + 1,
    total: count,
    amountCents,
    date: addMonths(purchaseDate, i),
    invoiceMonth: firstInvoice ? addMonths(firstInvoice, i) : null,
  }));
}
