import { describe, expect, it } from "vitest";
import { buildCategoryOptions, type CategoryRow } from "./categories";
import { extractionToDraft, receiptExtractionSchema, type ReceiptExtraction } from "./receipt";

const categories: CategoryRow[] = [
  { id: "alim", parent_id: null, name: "Alimentação", kind: "expense", archived: false },
  { id: "merc", parent_id: "alim", name: "Mercado", kind: "expense", archived: false },
  { id: "sal", parent_id: null, name: "Salário", kind: "income", archived: false },
];
const options = buildCategoryOptions(categories);

const accounts = [
  { id: "itau", name: "Conta Itaú", type: "checking" as const, institution: "Itaú" },
  { id: "nu-cc", name: "Conta Nubank", type: "checking" as const, institution: "Nubank" },
  { id: "nu-card", name: "Cartão Roxinho", type: "credit_card" as const, institution: "Nubank" },
];

const base: ReceiptExtraction = {
  is_receipt: true,
  document_type: "pix",
  direction: "saida",
  amount: 87.35,
  date: "2026-09-20",
  merchant: "Supermercado Dia",
  description: "Compra no mercado",
  payment_method: "pix",
  installments: null,
  card_last_digits: null,
  bank_or_issuer: "Nubank",
  category: "Alimentação › Mercado",
  confidence: "alta",
  notes: null,
};

const context = { accounts, categories: options, today: "2026-09-21" };

describe("receiptExtractionSchema", () => {
  it("valida a saída da IA", () => {
    expect(receiptExtractionSchema.parse(base)).toEqual(base);
    expect(() => receiptExtractionSchema.parse({ ...base, direction: "x" })).toThrow();
  });
});

describe("extractionToDraft", () => {
  it("monta o lançamento a partir do Pix", () => {
    expect(extractionToDraft(base, context)).toEqual({
      type: "expense",
      accountId: "nu-cc",
      amountCents: 8735,
      date: "2026-09-20",
      description: "Supermercado Dia",
      categoryId: "merc",
      installments: 1,
      notes: "Compra no mercado",
      warnings: [],
    });
  });

  it("crédito parcelado vai para o cartão", () => {
    const draft = extractionToDraft(
      { ...base, payment_method: "credito", installments: 3, category: "Mercado" },
      context,
    );
    expect(draft).toMatchObject({ accountId: "nu-card", installments: 3, categoryId: "merc" });
  });

  it("entrada vira receita e respeita o tipo da categoria", () => {
    const draft = extractionToDraft(
      { ...base, direction: "entrada", category: "Mercado", bank_or_issuer: "Itaú" },
      context,
    );
    expect(draft).toMatchObject({ type: "income", categoryId: null, accountId: "itau" });
  });

  it("avisa quando faltam dados ou a data é futura", () => {
    const draft = extractionToDraft(
      { ...base, amount: null, date: "2030-01-01", confidence: "baixa", is_receipt: false },
      context,
    );
    expect(draft.amountCents).toBeNull();
    expect(draft.date).toBe("2026-09-21");
    expect(draft.warnings).toHaveLength(4);
  });

  it("sem contas cadastradas", () => {
    expect(extractionToDraft(base, { ...context, accounts: [] }).accountId).toBeNull();
  });
});
