import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { matchRule } from "@/lib/rules";
import { normalizeText } from "@/lib/text";

type Db = SupabaseClient<Database>;

/** Cria/atualiza a regra e aplica nos lançamentos ainda sem categoria. Retorna quantos foram categorizados. */
export async function upsertRuleAndApply(
  db: Db,
  params: { householdId: string; pattern: string; categoryId: string },
): Promise<number> {
  const pattern = normalizeText(params.pattern);
  if (pattern.length < 2) throw new Error("O trecho da regra precisa ter pelo menos 2 letras.");

  const { error } = await db
    .from("category_rules")
    .upsert(
      { household_id: params.householdId, pattern, category_id: params.categoryId },
      { onConflict: "household_id,pattern" },
    );
  if (error) throw new Error(`Não foi possível salvar a regra: ${error.message}`);

  const [{ data: candidates, error: listError }, { data: category }] = await Promise.all([
    db
      .from("transactions")
      .select("id, description, amount_cents, type")
      .eq("household_id", params.householdId)
      .is("category_id", null)
      .neq("type", "transfer")
      .limit(1000),
    db.from("categories").select("kind").eq("id", params.categoryId).maybeSingle(),
  ]);
  if (listError) throw new Error(listError.message);

  const rule = [{ pattern, categoryId: params.categoryId }];
  const ids = (candidates ?? [])
    .filter((tx) => {
      // Categoria de receita só para receitas; de despesa só para despesas/estornos.
      const kindMatches = category?.kind === "income" ? tx.type === "income" : tx.type === "expense";
      return kindMatches && matchRule(tx.description, rule) !== null;
    })
    .map((tx) => tx.id);
  if (ids.length === 0) return 0;

  const { error: updateError } = await db
    .from("transactions")
    .update({ category_id: params.categoryId, category_source: "rule" })
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);
  return ids.length;
}
