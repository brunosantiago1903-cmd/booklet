import { describe, expect, it } from "vitest";
import { buildCategoryOptions, categoryLabel, type CategoryRow } from "./categories";
import { budgetStatuses, summarizeMonth } from "./reports";

const rows: CategoryRow[] = [
  { id: "alim", parent_id: null, name: "Alimentação", kind: "expense", archived: false },
  { id: "merc", parent_id: "alim", name: "Mercado", kind: "expense", archived: false },
  { id: "rest", parent_id: "alim", name: "Restaurantes", kind: "expense", archived: false },
  { id: "transp", parent_id: null, name: "Transporte", kind: "expense", archived: false },
  { id: "velho", parent_id: null, name: "Arquivada", kind: "expense", archived: true },
  { id: "sal", parent_id: null, name: "Salário", kind: "income", archived: false },
];
const byId = new Map(rows.map((r) => [r.id, r]));

describe("summarizeMonth", () => {
  it("agrupa por categoria principal e ignora transferências", () => {
    const summary = summarizeMonth(
      [
        { type: "income", amountCents: 500000, categoryId: "sal" },
        { type: "expense", amountCents: -10000, categoryId: "merc" },
        { type: "expense", amountCents: -5000, categoryId: "rest" },
        { type: "expense", amountCents: 2000, categoryId: "merc" }, // estorno
        { type: "expense", amountCents: -3000, categoryId: "transp" },
        { type: "expense", amountCents: -700, categoryId: null },
        { type: "transfer", amountCents: -99999, categoryId: null },
      ],
      byId,
    );
    expect(summary.incomeCents).toBe(500000);
    expect(summary.expenseCents).toBe(16700);
    expect(summary.balanceCents).toBe(483300);
    expect(summary.spendingByCategory).toEqual([
      { categoryId: "alim", name: "Alimentação", cents: 13000 },
      { categoryId: "transp", name: "Transporte", cents: 3000 },
      { categoryId: null, name: "Sem categoria", cents: 700 },
    ]);
  });
});

describe("budgetStatuses", () => {
  it("classifica o consumo do orçamento", () => {
    const statuses = budgetStatuses(
      [
        { categoryId: "alim", amountCents: 10000 },
        { categoryId: "transp", amountCents: 3500 },
        { categoryId: "velho", amountCents: 1000 },
      ],
      [
        { categoryId: "alim", name: "Alimentação", cents: 13000 },
        { categoryId: "transp", name: "Transporte", cents: 3000 },
      ],
      byId,
    );
    expect(statuses.map((s) => [s.categoryId, s.state])).toEqual([
      ["alim", "over"],
      ["transp", "warning"],
      ["velho", "ok"],
    ]);
  });
});

describe("categorias", () => {
  it("monta opções hierárquicas sem arquivadas", () => {
    expect(buildCategoryOptions(rows).map((o) => o.label)).toEqual([
      "Alimentação",
      "Alimentação › Mercado",
      "Alimentação › Restaurantes",
      "Salário",
      "Transporte",
    ]);
    expect(categoryLabel("merc", byId)).toBe("Alimentação › Mercado");
    expect(categoryLabel(null, byId)).toBeNull();
  });
});
