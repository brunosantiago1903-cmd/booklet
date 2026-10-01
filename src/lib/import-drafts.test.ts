import { describe, expect, it } from "vitest";
import { classifyImported, ofxToDrafts } from "./import-drafts";

describe("classifyImported", () => {
  it.each([
    [{ description: "PAGTO FATURA", accountType: "checking" as const, amountCents: -100 }, "transfer"],
    [{ description: "Pagamento recebido", accountType: "credit_card" as const, amountCents: 100 }, "transfer"],
    [{ description: "Estorno Loja", accountType: "credit_card" as const, amountCents: 100 }, "expense"],
    [{ description: "Mercado", accountType: "credit_card" as const, amountCents: -100 }, "expense"],
    [{ description: "Salário", accountType: "checking" as const, amountCents: 100 }, "income"],
    [{ description: "Cashback", accountType: "checking" as const, amountCents: 100 }, "income"],
  ])("%j → %s", (params, expected) => {
    expect(classifyImported(params)).toBe(expected);
  });
});

describe("ofxToDrafts", () => {
  it("calcula a fatura para cartão", () => {
    const drafts = ofxToDrafts(
      {
        accountType: "credit_card",
        currency: "BRL",
        transactions: [
          { externalId: "ofx:1", date: "2026-09-10", amountCents: -8990, description: "Farmácia" },
          { externalId: "ofx:2", date: "2026-09-12", amountCents: 150000, description: "Pagamento recebido" },
        ],
      },
      { type: "credit_card", closing_day: 3, due_day: 10 },
    );
    expect(drafts.map((d) => [d.type, d.invoiceMonth, d.status])).toEqual([
      ["expense", "2026-10-01", "cleared"],
      ["transfer", "2026-10-01", "cleared"],
    ]);
  });

  it("conta corrente sem fatura", () => {
    const [draft] = ofxToDrafts(
      { accountType: "checking", currency: null, transactions: [{ externalId: "ofx:x", date: "2026-01-01", amountCents: 500, description: "Pix recebido" }] },
      { type: "checking", closing_day: null, due_day: null },
    );
    expect(draft).toMatchObject({ type: "income", invoiceMonth: null, originalDescription: "Pix recebido" });
  });
});
