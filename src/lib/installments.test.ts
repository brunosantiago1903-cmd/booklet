import { describe, expect, it } from "vitest";
import { buildInstallmentPlan, splitInstallments } from "./installments";

describe("splitInstallments", () => {
  it("põe a diferença de centavos na primeira parcela", () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitInstallments(10001, 2)).toEqual([5001, 5000]);
    expect(splitInstallments(500, 1)).toEqual([500]);
  });

  it("a soma das parcelas é o total", () => {
    for (const [total, n] of [[99999, 7], [1, 1], [12345, 12], [7, 10]]) {
      const parts = splitInstallments(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("rejeita entradas inválidas", () => {
    expect(() => splitInstallments(0, 2)).toThrow();
    expect(() => splitInstallments(100, 0)).toThrow();
    expect(() => splitInstallments(10.5, 2)).toThrow();
  });
});

describe("buildInstallmentPlan", () => {
  it("cartão: cada parcela cai na fatura seguinte", () => {
    const plan = buildInstallmentPlan({
      totalCents: 30000,
      count: 3,
      purchaseDate: "2026-01-31",
      card: { closingDay: 3, dueDay: 10 },
    });
    expect(plan).toEqual([
      { number: 1, total: 3, amountCents: 10000, date: "2026-01-31", invoiceMonth: "2026-02-01" },
      { number: 2, total: 3, amountCents: 10000, date: "2026-02-28", invoiceMonth: "2026-03-01" },
      { number: 3, total: 3, amountCents: 10000, date: "2026-03-31", invoiceMonth: "2026-04-01" },
    ]);
  });

  it("conta: só a data avança", () => {
    const plan = buildInstallmentPlan({ totalCents: 1000, count: 2, purchaseDate: "2026-05-10" });
    expect(plan.map((p) => [p.date, p.invoiceMonth])).toEqual([
      ["2026-05-10", null],
      ["2026-06-10", null],
    ]);
  });
});
