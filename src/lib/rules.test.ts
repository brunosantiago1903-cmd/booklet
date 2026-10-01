import { describe, expect, it } from "vitest";
import { looksLikeCardBillPayment, looksLikeRefund, matchRule } from "./rules";
import { normalizeText, suggestRulePattern } from "./text";

describe("normalizeText / suggestRulePattern", () => {
  it("normaliza acentos e pontuação", () => {
    expect(normalizeText("  PADARIA São João - Ltda. ")).toBe("padaria sao joao ltda");
  });

  it("sugere trecho sem ruído do extrato", () => {
    expect(suggestRulePattern("PIX ENVIADO - IFOOD *RESTAURANTE 12/09")).toBe("ifood restaurante");
    expect(suggestRulePattern("COMPRA CARTAO DEB POSTO IPIRANGA 123")).toBe("posto ipiranga");
    expect(suggestRulePattern("Uber *Trip")).toBe("uber trip");
    expect(suggestRulePattern("123 456")).toBe("");
  });
});

describe("matchRule", () => {
  const rules = [
    { pattern: "uber", categoryId: "transporte" },
    { pattern: "uber eats", categoryId: "delivery" },
    { pattern: "posto", categoryId: "combustivel" },
  ];

  it("vence o trecho mais longo", () => {
    expect(matchRule("UBER *EATS PENDING", rules)).toBe("delivery");
    expect(matchRule("Uber *Trip", rules)).toBe("transporte");
  });

  it("casa o trecho dentro de palavras e com espaços diferentes", () => {
    expect(matchRule("POSTO SHELL", rules)).toBe("combustivel");
    expect(matchRule("SUPERMERCADO EXTRA", [{ pattern: "mercado", categoryId: "merc" }])).toBe("merc");
    expect(matchRule("IFOODCOM AGENCIA", [{ pattern: "ifood com", categoryId: "delivery" }])).toBe("delivery");
    expect(matchRule("FARMACIA", rules)).toBeNull();
  });

  it("ignora acentos e caixa", () => {
    expect(matchRule("Farmácia", [{ pattern: "FARMACIA", categoryId: "saude" }])).toBe("saude");
  });
});

describe("looksLikeCardBillPayment", () => {
  it("no cartão: crédito com 'pagamento'", () => {
    expect(
      looksLikeCardBillPayment({ description: "Pagamento recebido", accountType: "credit_card", amountCents: 50000 }),
    ).toBe(true);
    expect(
      looksLikeCardBillPayment({ description: "Estorno pagamento duplicado", accountType: "credit_card", amountCents: 100 }),
    ).toBe(false);
    expect(
      looksLikeCardBillPayment({ description: "Pagamento recebido", accountType: "credit_card", amountCents: -100 }),
    ).toBe(false);
  });

  it("na conta: débito de fatura", () => {
    expect(
      looksLikeCardBillPayment({ description: "PAGTO FATURA NUBANK", accountType: "checking", amountCents: -50000 }),
    ).toBe(true);
    expect(
      looksLikeCardBillPayment({ description: "Pagamento cartão de crédito", accountType: "checking", amountCents: -1 }),
    ).toBe(true);
    expect(
      looksLikeCardBillPayment({ description: "PIX ENVIADO MERCADO", accountType: "checking", amountCents: -1 }),
    ).toBe(false);
  });

  it("estorno", () => {
    expect(looksLikeRefund("ESTORNO COMPRA LOJA")).toBe(true);
    expect(looksLikeRefund("Compra loja")).toBe(false);
  });
});
