import { describe, expect, it } from "vitest";
import { dueDateOf, summarizeCard } from "./cards";

describe("summarizeCard", () => {
  const base = { closingDay: 3, dueDay: 10, creditLimitCents: 500000 };

  it("fatura aberta e fechada a pagar", () => {
    const summary = summarizeCard({
      ...base,
      balanceCents: -150000,
      today: "2026-10-05",
      invoices: [
        { invoice_month: "2026-11-01", charges_cents: 30000, payments_cents: 0 },
        { invoice_month: "2026-10-01", charges_cents: 120000, payments_cents: 0 },
      ],
    });
    expect(summary).toEqual({
      openInvoiceMonth: "2026-11-01",
      openDueDate: "2026-11-10",
      openCents: 30000,
      closedInvoiceMonth: "2026-10-01",
      closedDueDate: "2026-10-10",
      closedRemainingCents: 120000,
      closedState: "due",
      limitCents: 500000,
      usedCents: 150000,
    });
  });

  it("fatura quitada e vencida", () => {
    const invoices = [{ invoice_month: "2026-10-01", charges_cents: 120000, payments_cents: 120000 }];
    expect(summarizeCard({ ...base, balanceCents: 0, today: "2026-10-05", invoices }).closedState).toBe("paid");
    expect(
      summarizeCard({
        ...base,
        balanceCents: -1,
        today: "2026-10-12",
        invoices: [{ invoice_month: "2026-10-01", charges_cents: 100, payments_cents: 0 }],
      }),
    ).toMatchObject({ closedState: "overdue", openInvoiceMonth: "2026-11-01" });
  });

  it("vencida quando passou do vencimento sem pagamento", () => {
    // Fecha 25, vence 5: em 07/10 a fatura fechada é a de outubro (venceu dia 5).
    const summary = summarizeCard({
      closingDay: 25,
      dueDay: 5,
      creditLimitCents: null,
      balanceCents: -100,
      today: "2026-10-07",
      invoices: [{ invoice_month: "2026-10-01", charges_cents: 100, payments_cents: 0 }],
    });
    expect(summary).toMatchObject({ closedInvoiceMonth: "2026-10-01", closedState: "overdue" });
  });

  it("vencimento limitado ao fim do mês", () => {
    expect(dueDateOf("2026-02-01", 31)).toBe("2026-02-28");
  });
});
