import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestCategories } from "@/lib/ai/categorize";
import { buildCategoryOptions } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import { isAiConfigured } from "@/lib/env";

type Db = SupabaseClient<Database>;

/**
 * Pede à IA categorias para lançamentos ainda sem categoria (mais recentes primeiro).
 * Sem ANTHROPIC_API_KEY não faz nada. Retorna quantos foram categorizados.
 */
export async function categorizeWithAi(
  db: Db,
  householdId: string,
  { limit = 160, ids }: { limit?: number; ids?: string[] } = {},
): Promise<number> {
  if (!isAiConfigured()) return 0;

  let query = db
    .from("transactions")
    .select("id, description, amount_cents, type")
    .eq("household_id", householdId)
    .is("category_id", null)
    .neq("type", "transfer")
    .order("date", { ascending: false })
    .limit(limit);
  if (ids) {
    if (ids.length === 0) return 0;
    query = query.in("id", ids.slice(0, limit));
  }

  const [{ data: transactions, error }, { data: categories, error: categoriesError }] = await Promise.all([
    query,
    db.from("categories").select("id, parent_id, name, kind, archived").eq("household_id", householdId),
  ]);
  if (error) throw new Error(error.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (!transactions?.length || !categories?.length) return 0;

  const suggestions = await suggestCategories(
    transactions.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amountCents: tx.amount_cents,
      kind: tx.type === "income" ? "income" : "expense",
    })),
    buildCategoryOptions(categories),
  );

  const idsByCategory = new Map<string, string[]>();
  for (const [txId, categoryId] of suggestions) {
    idsByCategory.set(categoryId, [...(idsByCategory.get(categoryId) ?? []), txId]);
  }
  let updated = 0;
  for (const [categoryId, txIds] of idsByCategory) {
    const { error: updateError } = await db
      .from("transactions")
      .update({ category_id: categoryId, category_source: "ai" })
      .in("id", txIds)
      .is("category_id", null);
    if (updateError) throw new Error(updateError.message);
    updated += txIds.length;
  }
  return updated;
}
