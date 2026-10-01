import { z } from "zod";
import type { CategoryOption } from "./categories";
import { addDays, isISODate, type ISODate } from "./dates";
import { toCents } from "./money";
import { normalizeText } from "./text";

/** Formato que a IA devolve ao ler um comprovante. */
export const receiptExtractionSchema = z.object({
  is_receipt: z
    .boolean()
    .describe("true se o arquivo é um comprovante, nota, cupom, recibo ou fatura de um pagamento/recebimento"),
  document_type: z.enum(["pix", "boleto", "cartao", "nota_fiscal", "transferencia", "outro"]),
  direction: z.enum(["saida", "entrada"]).describe("saida = dinheiro saiu do casal; entrada = dinheiro recebido"),
  amount: z.number().nullable().describe("valor total pago ou recebido, em reais, positivo"),
  date: z.string().nullable().describe("data do pagamento no formato YYYY-MM-DD"),
  merchant: z.string().nullable().describe("estabelecimento, favorecido ou pagador"),
  description: z.string().describe("descrição curta do gasto, em português, até 60 caracteres"),
  payment_method: z
    .enum(["pix", "boleto", "debito", "credito", "dinheiro", "transferencia", "outro"])
    .nullable(),
  installments: z.number().int().nullable().describe("número de parcelas se for compra parcelada no crédito"),
  card_last_digits: z.string().nullable(),
  bank_or_issuer: z.string().nullable().describe("banco, carteira ou emissor do cartão usado"),
  category: z.string().nullable().describe("rótulo exato de uma categoria da lista fornecida"),
  confidence: z.enum(["alta", "media", "baixa"]),
  notes: z.string().nullable().describe("observações úteis: itens principais, número do documento etc."),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export type AccountOption = {
  id: string;
  name: string;
  type: "checking" | "credit_card";
  institution: string | null;
};

export type ReceiptDraft = {
  type: "income" | "expense";
  accountId: string | null;
  amountCents: number | null;
  date: ISODate;
  description: string;
  categoryId: string | null;
  installments: number;
  notes: string;
  warnings: string[];
};

function pickAccount(extraction: ReceiptExtraction, accounts: AccountOption[]): string | null {
  if (accounts.length === 0) return null;
  const wantsCard = extraction.payment_method === "credito";
  const preferred = accounts.filter((a) => (wantsCard ? a.type === "credit_card" : a.type === "checking"));
  const pool = preferred.length > 0 ? preferred : accounts;

  const issuer = extraction.bank_or_issuer ? normalizeText(extraction.bank_or_issuer) : "";
  if (issuer) {
    const byIssuer = pool.find((a) => {
      const haystack = normalizeText(`${a.name} ${a.institution ?? ""}`);
      return issuer.split(" ").some((word) => word.length > 2 && haystack.includes(word));
    });
    if (byIssuer) return byIssuer.id;
  }
  return pool[0].id;
}

function pickCategory(
  label: string | null,
  kind: "income" | "expense",
  categories: CategoryOption[],
): string | null {
  if (!label) return null;
  const wanted = normalizeText(label);
  const sameKind = categories.filter((c) => c.kind === kind);
  const exact = sameKind.find((c) => normalizeText(c.label) === wanted);
  if (exact) return exact.id;
  // Aceita só o nome da subcategoria ("Mercado") ou da principal.
  const byLastPart = sameKind.find((c) => normalizeText(c.label.split("›").pop() ?? "") === wanted);
  return byLastPart?.id ?? null;
}

/** Converte a leitura da IA em valores iniciais do formulário de lançamento. */
export function extractionToDraft(
  extraction: ReceiptExtraction,
  context: { accounts: AccountOption[]; categories: CategoryOption[]; today: ISODate },
): ReceiptDraft {
  const warnings: string[] = [];
  const type = extraction.direction === "entrada" ? "income" : "expense";

  if (!extraction.is_receipt) {
    warnings.push("O arquivo não parece ser um comprovante. Confira os dados.");
  }
  if (extraction.confidence === "baixa") {
    warnings.push("A leitura teve baixa confiança. Confira valor e data.");
  }

  let amountCents: number | null = null;
  if (extraction.amount !== null && Number.isFinite(extraction.amount) && extraction.amount !== 0) {
    amountCents = Math.abs(toCents(extraction.amount));
  } else {
    warnings.push("Não foi possível ler o valor.");
  }

  let date = context.today;
  if (extraction.date && isISODate(extraction.date) && extraction.date <= addDays(context.today, 1)) {
    date = extraction.date;
  } else {
    warnings.push("Data não identificada; usamos a data de hoje.");
  }

  const description = (extraction.merchant?.trim() || extraction.description.trim() || "Comprovante").slice(0, 120);
  const installments =
    extraction.payment_method === "credito" && extraction.installments && extraction.installments > 1
      ? Math.min(extraction.installments, 48)
      : 1;

  const notesParts = [
    extraction.merchant && extraction.description && extraction.description !== extraction.merchant
      ? extraction.description
      : null,
    extraction.notes,
  ].filter((part): part is string => !!part && part.trim().length > 0);

  return {
    type,
    accountId: pickAccount(extraction, context.accounts),
    amountCents,
    date,
    description,
    categoryId: pickCategory(extraction.category, type, context.categories),
    installments,
    notes: notesParts.join(" — ").slice(0, 500),
    warnings,
  };
}
