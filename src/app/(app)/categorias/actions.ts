"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";

export type CategoryActionState = { error: string | null; ok?: string };

function done(message?: string): CategoryActionState {
  revalidatePath("/", "layout");
  return { error: null, ok: message };
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  kind: z.enum(["income", "expense"]),
  parent_id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function createCategory(_prev: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { supabase, householdId } = await getAppContext();
  let kind = parsed.data.kind;
  if (parsed.data.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("kind, parent_id")
      .eq("id", parsed.data.parent_id)
      .maybeSingle();
    if (!parent) return { error: "Categoria principal não encontrada." };
    if (parent.parent_id) return { error: "Subcategorias têm só um nível." };
    kind = parent.kind;
  }
  const { error } = await supabase.from("categories").insert({
    household_id: householdId,
    name: parsed.data.name,
    kind,
    parent_id: parsed.data.parent_id ?? null,
  });
  if (error) {
    return { error: error.code === "23505" ? "Já existe uma categoria com esse nome aqui." : error.message };
  }
  return done("Categoria criada.");
}

export async function renameCategory(_prev: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };
  const { supabase } = await getAppContext();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  return done("Nome atualizado.");
}

export async function toggleCategoryArchived(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  const { supabase } = await getAppContext();
  const { error } = await supabase.from("categories").update({ archived }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function saveBudget(_prev: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  const categoryId = String(formData.get("category_id") ?? "");
  const raw = String(formData.get("amount") ?? "").trim();
  const { supabase, householdId } = await getAppContext();

  if (!raw) {
    const { error } = await supabase.from("budgets").delete().eq("category_id", categoryId);
    if (error) return { error: error.message };
    return done("Orçamento removido.");
  }
  const cents = parseMoneyToCents(raw);
  if (cents === null || cents <= 0) return { error: "Valor inválido." };
  const { error } = await supabase
    .from("budgets")
    .upsert({ household_id: householdId, category_id: categoryId, amount_cents: cents }, { onConflict: "household_id,category_id" });
  if (error) return { error: error.message };
  return done("Orçamento salvo.");
}

export async function deleteRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { supabase } = await getAppContext();
  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/categorias");
}
