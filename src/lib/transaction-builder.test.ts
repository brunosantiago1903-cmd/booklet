import { describe, expect, it } from "vitest";
import { buildNewTransactionRows, kindOf, type NewTransactionInput } from "./transaction-builder";

const checking = { id: "cc", type: "checking" as const, closing_day: null, due_day: null };
const card = { id: "card", type: "credit_card" as const, closing_day: 3, due_day: 10 };

function input(overrides: Partial<NewTransactionInput>): NewTransactionInput {
  let n = 0;
  return {
    kind: "expense",
    account: checking,
    amountCents: 10000,
    date: "2026-09-15",
    description: " Mercado ",
    categoryId: "merc",
    notes: "  ",
    installments: 1,
    source: "manual",
    receiptId: null,
    createdBy: "m1",
    newId: () => `g${++n}`,
    ...overrides,
  };
}

describe("buildNewTransactionRows", () => {
  it("despesa simples na conta", () => {
    expect(buildNewTransactionRows(input({}))).toEqual([
      {
        description: "Mercado",
        notes: null,
        source: "manual",
        receipt_id: null,
        created_by: "m1",
        status: "cleared",
        category_id: "merc",
        category_source: "user",
        account_id: "cc",
        type: "expense",
        amount_cents: -10000,
        date: "2026-09-15",
        invoice_month: null,
      },
    ]);
  });

  it("receita e estorno são positivos", () => {
    expect(buildNewTransactionRows(input({ kind: "income" }))[0]).toMatchObject({ type: "income", amount_cents: 10000 });
    expect(buildNewTransactionRows(input({ kind: "refund", account: card }))[0]).toMatchObject({
      type: "expense",
      amount_cents: 10000,
      invoice_month: "2026-10-01",
    });
  });

  it("compra parcelada no cartão", () => {
    const rows = buildNewTransactionRows(
      input({ account: card, installments: 3, receiptId: "r1", source: "receipt", date: "2026-09-02" }),
    );
    expect(rows.map((r) => [r.amount_cents, r.date, r.invoice_month, r.installment_number, r.receipt_id])).toEqual([
      [-3334, "2026-09-02", "2026-09-01", 1, "r1"],
      [-3333, "2026-10-02", "2026-10-01", 2, null],
      [-3333, "2026-11-02", "2026-11-01", 3, null],
    ]);
    expect(new Set(rows.map((r) => r.installment_group_id))).toEqual(new Set(["g1"]));
  });

  it("fatura escolhida manualmente desloca todas as parcelas", () => {
    const rows = buildNewTransactionRows(input({ account: card, installments: 2, invoiceMonth: "2026-12-01" }));
    expect(rows.map((r) => r.invoice_month)).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("parcelas só valem para despesa", () => {
    expect(buildNewTransactionRows(input({ kind: "income", installments: 5 }))).toHaveLength(1);
  });

  it("pagamento de fatura: transferência conta → cartão", () => {
    const rows = buildNewTransactionRows(
      input({ kind: "transfer", toAccount: card, date: "2026-10-09", categoryId: "merc", receiptId: "r9" }),
    );
    expect(rows.map((r) => [r.account_id, r.amount_cents, r.invoice_month, r.category_id, r.receipt_id])).toEqual([
      ["cc", -10000, null, null, "r9"],
      ["card", 10000, "2026-10-01", null, null],
    ]);
    expect(rows[0].transfer_group_id).toBe(rows[1].transfer_group_id);
  });

  it("validações", () => {
    expect(() => buildNewTransactionRows(input({ amountCents: 0 }))).toThrow(/valor/);
    expect(() => buildNewTransactionRows(input({ description: "  " }))).toThrow(/descrição/);
    expect(() => buildNewTransactionRows(input({ kind: "transfer" }))).toThrow(/destino/);
    expect(() => buildNewTransactionRows(input({ kind: "transfer", toAccount: checking }))).toThrow(/diferente/);
  });
});

describe("kindOf", () => {
  it("deduz o tipo do formulário", () => {
    expect(kindOf({ type: "expense", amount_cents: -1 })).toBe("expense");
    expect(kindOf({ type: "expense", amount_cents: 1 })).toBe("refund");
    expect(kindOf({ type: "income", amount_cents: 1 })).toBe("income");
    expect(kindOf({ type: "transfer", amount_cents: -1 })).toBe("transfer");
  });
});
