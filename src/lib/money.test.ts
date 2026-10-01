import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseMoneyToCents, toCents } from "./money";

describe("parseMoneyToCents", () => {
  it.each([
    ["12", 1200],
    ["12,3", 1230],
    ["12,30", 1230],
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["1,234,567", 123456700],
    ["1,234.56", 123456],
    ["R$ 1.234,56", 123456],
    ["r$12,00", 1200],
    ["-12,30", -1230],
    ["+5", 500],
    [",50", 50],
    ["0,05", 5],
    ["  7,9 ", 790],
  ])("lê %s", (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1,2,3,4.5,6", "--1", "12a"])("rejeita %j", (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe("formatCents", () => {
  it("formata em reais", () => {
    expect(formatCents(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatCents(-5).replace(/\s/g, " ")).toBe("-R$ 0,05");
  });
});

describe("toCents", () => {
  it("arredonda ponto flutuante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(-45.5)).toBe(-4550);
  });
});

describe("centsToInput", () => {
  it("formata para edição", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(-1230)).toBe("-12,30");
  });
});
