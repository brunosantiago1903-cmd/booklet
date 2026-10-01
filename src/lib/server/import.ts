import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/database.types";
import { addDays, type ISODate } from "@/lib/dates";
import type { ImportedTransactionDraft } from "@/lib/import-drafts";
import { planImport, type ExistingTransaction } from "@/lib/import-plan";

type Db = SupabaseClient<Database>;

export type ImportResult = {
  inserted: number;
  updated: number;
  linked: number;
  removed: number;
  /** Lançamentos novos sem categoria (candidatos à IA). */
  uncategorizedIds: string[];
};

const PAGE = 1000;

async function loadExisting(db: Db, accountId: string, since: ISODate): Promise<ExistingTransaction[]> {
  const rows: ExistingTransaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("transactions")
      .select("id, account_id, amount_cents, date, source, status, external_id, invoice_month, original_description")
      .eq("account_id", accountId)
      .gte("date", since)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Erro ao ler lançamentos: ${error.message}`);
    for (const row of data ?? []) {
      rows.push({
        id: row.id,
        accountId: row.account_id,
        amountCents: Number(row.amount_cents),
        date: row.date,
        source: row.source,
        status: row.status,
        externalId: row.external_id,
        invoiceMonth: row.invoice_month,
        originalDescription: row.original_description,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Grava lançamentos vindos do banco (Open Finance ou OFX) numa conta, sem duplicar. */
export async function importTransactions(
  db: Db,
  params: {
    householdId: string;
    accountId: string;
    source: "open_finance" | "ofx";
    drafts: ImportedTransactionDraft[];
    pendingWindowStart: ISODate | null;
  },
): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, updated: 0, linked: 0, removed: 0, uncategorizedIds: [] };
  if (params.drafts.length === 0 && !params.pendingWindowStart) return result;

  const earliest = params.drafts.reduce<ISODate | null>(
    (min, d) => (min === null || d.date < min ? d.date : min),
    params.pendingWindowStart,
  );
  // Folga para casar com lançamentos manuais de dias antes e para datas que mudaram.
  const since = addDays(earliest ?? params.pendingWindowStart ?? "1970-01-01", -10);

  const [existing, rules, categories] = await Promise.all([
    loadExisting(db, params.accountId, since),
    db.from("category_rules").select("pattern, category_id").eq("household_id", params.householdId),
    db.from("categories").select("id, kind").eq("household_id", params.householdId),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (categories.error) throw new Error(categories.error.message);

  const plan = planImport({
    accountId: params.accountId,
    source: params.source,
    drafts: params.drafts,
    existing,
    rules: (rules.data ?? []).map((r) => ({ pattern: r.pattern, categoryId: r.category_id })),
    categoryKinds: new Map((categories.data ?? []).map((c) => [c.id, c.kind])),
    pendingWindowStart: params.pendingWindowStart,
  });

  for (const update of plan.updates) {
    const { error } = await db.from("transactions").update(update.changes).eq("id", update.id);
    if (error) throw new Error(`Erro ao atualizar lançamento: ${error.message}`);
    if (update.linked) result.linked += 1;
    else result.updated += 1;
  }

  if (plan.deleteIds.length > 0) {
    const { error } = await db.from("transactions").delete().in("id", plan.deleteIds);
    if (error) throw new Error(`Erro ao remover pendentes: ${error.message}`);
    result.removed = plan.deleteIds.length;
  }

  const rows: TablesInsert<"transactions">[] = plan.inserts.map(({ draft, categoryId }) => ({
    household_id: params.householdId,
    account_id: params.accountId,
    type: draft.type,
    amount_cents: draft.amountCents,
    date: draft.date,
    invoice_month: draft.invoiceMonth,
    description: draft.description,
    original_description: draft.originalDescription,
    status: draft.status,
    installment_number: draft.installmentNumber,
    installment_total: draft.installmentTotal,
    source: params.source,
    external_id: draft.externalId,
    category_id: categoryId,
    category_source: categoryId ? "rule" : null,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await db.from("transactions").insert(chunk).select("id, category_id, type");
    if (error) throw new Error(`Erro ao inserir lançamentos: ${error.message}`);
    result.inserted += data?.length ?? 0;
    for (const row of data ?? []) {
      if (!row.category_id && row.type !== "transfer") result.uncategorizedIds.push(row.id);
    }
  }
  return result;
}
