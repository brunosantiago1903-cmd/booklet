import { describe, expect, it } from "vitest";
import { mapPluggyAccount, mapPluggyTransaction, pluggyDateToISO, type PluggyTransactionLike } from "./pluggy-map";

const card = { accountType: "credit_card" as const, closingDay: 3, dueDay: 10, billInvoiceMonths: new Map<string, string>() };
const checking = { accountType: "checking" as const, closingDay: null, dueDay: null, billInvoiceMonths: new Map<string, string>() };

function tx(overrides: Partial<PluggyTransactionLike>): PluggyTransactionLike {
  return {
    id: "t1",
    date: "2026-09-10T03:00:00.000Z",
    description: "Mercado Bom Preço",
    type: "DEBIT",
    amount: 45.9,
    status: "POSTED",
    creditCardMetadata: null,
    ...overrides,
  };
}

describe("pluggyDateToISO", () => {
  it("meia-noite UTC é data pura", () => {
    expect(pluggyDateToISO("2026-09-10T00:00:00.000Z")).toBe("2026-09-10");
    expect(pluggyDateToISO(new Date("2026-09-10T00:00:00Z"))).toBe("2026-09-10");
  });

  it("instante com horário usa o fuso de São Paulo", () => {
    expect(pluggyDateToISO("2026-09-10T03:00:00.000Z")).toBe("2026-09-10");
    expect(pluggyDateToISO("2026-09-11T01:00:00.000Z")).toBe("2026-09-10");
  });
});

describe("mapPluggyTransaction", () => {
  it("DEBIT vira saída negativa, independente do sinal do valor", () => {
    expect(mapPluggyTransaction(tx({ amount: 45.9 }), checking).amountCents).toBe(-4590);
    expect(mapPluggyTransaction(tx({ amount: -45.9 }), checking).amountCents).toBe(-4590);
    expect(mapPluggyTransaction(tx({ type: "CREDIT", amount: -100 }), checking)).toMatchObject({
      amountCents: 10000,
      type: "income",
    });
  });

  it("pendente e descrição original", () => {
    const draft = mapPluggyTransaction(
      tx({ status: "PENDING", description: "  Mercado   Bom ", descriptionRaw: "MERCADO BOM PRECO LTDA" }),
      checking,
    );
    expect(draft).toMatchObject({
      status: "pending",
      description: "Mercado Bom",
      originalDescription: "MERCADO BOM PRECO LTDA",
      invoiceMonth: null,
    });
  });

  it("pagamento de fatura vira transferência", () => {
    expect(mapPluggyTransaction(tx({ description: "PAGTO FATURA CARTAO" }), checking).type).toBe("transfer");
    expect(
      mapPluggyTransaction(tx({ type: "CREDIT", description: "Pagamento recebido", amount: 500 }), card).type,
    ).toBe("transfer");
  });

  it("estorno no cartão abate despesa", () => {
    expect(
      mapPluggyTransaction(tx({ type: "CREDIT", description: "Estorno compra", amount: 20 }), card),
    ).toMatchObject({ type: "expense", amountCents: 2000 });
  });

  it("fatura: billId > previsão > cálculo pelo fechamento", () => {
    const bills = new Map([["bill-1", "2026-11-01"]]);
    expect(
      mapPluggyTransaction(tx({ creditCardMetadata: { billId: "bill-1", billForecastDate: "2026-12" } }), {
        ...card,
        billInvoiceMonths: bills,
      }).invoiceMonth,
    ).toBe("2026-11-01");
    expect(mapPluggyTransaction(tx({ creditCardMetadata: { billForecastDate: "2026-12" } }), card).invoiceMonth).toBe(
      "2026-12-01",
    );
    // Compra em 10/09 com fechamento dia 3 → vence 10/10.
    expect(mapPluggyTransaction(tx({}), card).invoiceMonth).toBe("2026-10-01");
  });

  it("parcela futura datada pela compra avança a fatura", () => {
    const draft = mapPluggyTransaction(
      tx({
        creditCardMetadata: {
          installmentNumber: 3,
          totalInstallments: 5,
          purchaseDate: "2026-09-10T03:00:00.000Z",
        },
      }),
      card,
    );
    expect(draft).toMatchObject({ invoiceMonth: "2026-12-01", installmentNumber: 3, installmentTotal: 5 });
  });

  it("ignora metadados de parcela inconsistentes", () => {
    const draft = mapPluggyTransaction(
      tx({ creditCardMetadata: { installmentNumber: 1, totalInstallments: 1 } }),
      card,
    );
    expect(draft.installmentNumber).toBeNull();
  });
});

describe("mapPluggyAccount", () => {
  it("conta corrente", () => {
    expect(mapPluggyAccount({ id: "a", type: "BANK", name: "Conta Corrente", marketingName: null })).toMatchObject({
      type: "checking",
      name: "Conta Corrente",
    });
  });

  it("cartão com dias do banco", () => {
    expect(
      mapPluggyAccount({
        id: "c",
        type: "CREDIT",
        name: "Cartão",
        marketingName: "Nubank Ultravioleta",
        creditData: {
          balanceCloseDate: "2026-10-03T00:00:00.000Z",
          balanceDueDate: "2026-10-10T00:00:00.000Z",
          creditLimit: 5000,
        },
      }),
    ).toEqual({
      name: "Nubank Ultravioleta",
      type: "credit_card",
      closingDay: 3,
      dueDay: 10,
      creditLimitCents: 500000,
      needsReview: false,
    });
  });

  it("cartão sem dias pede revisão", () => {
    expect(mapPluggyAccount({ id: "c", type: "CREDIT", name: "Cartão" })).toMatchObject({
      closingDay: 1,
      dueDay: 10,
      needsReview: true,
    });
  });
});
