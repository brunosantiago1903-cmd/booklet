import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addMonthsToKey,
  diffDays,
  formatDateBR,
  formatMonthBR,
  invoiceFor,
  invoicePaidOn,
  isISODate,
  monthRange,
  todayISO,
} from "./dates";

describe("todayISO", () => {
  it("usa o fuso de São Paulo, não UTC", () => {
    // 01/10 às 01:30 UTC ainda é 30/09 em São Paulo (UTC-3).
    expect(todayISO(new Date("2026-10-01T01:30:00Z"))).toBe("2026-09-30");
    expect(todayISO(new Date("2026-10-01T03:30:00Z"))).toBe("2026-10-01");
  });
});

describe("aritmética de datas", () => {
  it("valida datas", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("26-01-01")).toBe(false);
  });

  it("soma meses limitando ao fim do mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 13)).toBe("2027-02-28");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
  });

  it("soma dias e calcula diferença", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(diffDays("2026-02-27", "2026-03-01")).toBe(2);
    expect(diffDays("2026-03-01", "2026-02-27")).toBe(-2);
  });

  it("intervalo do mês", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
    expect(addMonthsToKey("2026-01", -1)).toBe("2025-12");
  });

  it("formata em português", () => {
    expect(formatDateBR("2026-09-05")).toBe("05/09/2026");
    expect(formatMonthBR("2026-03")).toBe("março de 2026");
    expect(formatMonthBR("2026-03", { short: true })).toBe("mar/26");
  });
});

describe("invoiceFor (fatura do cartão)", () => {
  it("fechamento antes do vencimento no mesmo mês (fecha 3, vence 10)", () => {
    expect(invoiceFor("2026-01-15", 3, 10)).toEqual({
      closingDate: "2026-02-03",
      dueDate: "2026-02-10",
      invoiceMonth: "2026-02-01",
    });
    expect(invoiceFor("2026-02-02", 3, 10).invoiceMonth).toBe("2026-02-01");
  });

  it("compra no dia do fechamento vai para a fatura seguinte", () => {
    expect(invoiceFor("2026-02-03", 3, 10).invoiceMonth).toBe("2026-03-01");
  });

  it("vencimento no mês seguinte ao fechamento (fecha 25, vence 5)", () => {
    expect(invoiceFor("2026-01-20", 25, 5)).toEqual({
      closingDate: "2026-01-25",
      dueDate: "2026-02-05",
      invoiceMonth: "2026-02-01",
    });
    expect(invoiceFor("2026-01-26", 25, 5).invoiceMonth).toBe("2026-03-01");
  });

  it("virada de ano", () => {
    expect(invoiceFor("2026-12-28", 25, 5).invoiceMonth).toBe("2027-02-01");
    expect(invoiceFor("2026-12-20", 25, 5).invoiceMonth).toBe("2027-01-01");
  });

  it("dia de fechamento maior que o mês é limitado ao último dia", () => {
    // Fecha dia 30: em fevereiro fecha dia 28.
    expect(invoiceFor("2026-02-27", 30, 7).closingDate).toBe("2026-02-28");
    expect(invoiceFor("2026-02-28", 30, 7).closingDate).toBe("2026-03-30");
  });

  it("pagamento quita a última fatura fechada", () => {
    expect(invoicePaidOn("2026-02-09", 3, 10)).toBe("2026-02-01");
    expect(invoicePaidOn("2026-02-04", 25, 5)).toBe("2026-02-01");
  });
});
