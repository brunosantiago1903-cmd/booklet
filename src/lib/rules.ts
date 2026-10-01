import { normalizeText } from "./text";

export type CategoryRule = { pattern: string; categoryId: string };

/**
 * Aplica as regras do casal: vence o trecho mais longo contido na descrição.
 * A comparação ignora acentos, caixa e pontuação, e respeita limites de palavra.
 */
export function matchRule(description: string, rules: CategoryRule[]): string | null {
  const text = ` ${normalizeText(description)} `;
  let best: CategoryRule | null = null;
  for (const rule of rules) {
    const pattern = normalizeText(rule.pattern);
    if (pattern.length < 2) continue;
    if (text.includes(` ${pattern} `) && (!best || pattern.length > normalizeText(best.pattern).length)) {
      best = rule;
    }
  }
  return best?.categoryId ?? null;
}

const CARD_PAYMENT_RE = /\b(pagamento|pagto|pgto|pag)\b/;
const CARD_REFUND_RE = /\b(estorno|cancelamento|reembolso|devolucao|cashback)\b/;
const BILL_PAYMENT_RE =
  /\b(fatura|pagamento cartao|pagto cartao|pgto cartao|pag cartao|cartao de credito|pagamento de cartao)\b/;

/**
 * Identifica pagamentos de fatura em lançamentos importados, para tratá-los como
 * transferência (senão a mesma despesa seria contada duas vezes: na compra e no pagamento).
 */
export function looksLikeCardBillPayment(params: {
  description: string;
  accountType: "checking" | "credit_card";
  amountCents: number;
}): boolean {
  const text = normalizeText(params.description);
  if (params.accountType === "credit_card") {
    // No cartão, o pagamento aparece como crédito (valor positivo).
    return params.amountCents > 0 && CARD_PAYMENT_RE.test(text) && !CARD_REFUND_RE.test(text);
  }
  // Na conta, aparece como débito.
  return params.amountCents < 0 && BILL_PAYMENT_RE.test(text);
}

/** Estornos e devoluções no cartão reduzem a despesa em vez de virar receita. */
export function looksLikeRefund(description: string): boolean {
  return CARD_REFUND_RE.test(normalizeText(description));
}
