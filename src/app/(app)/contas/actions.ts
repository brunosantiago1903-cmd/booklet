"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";

export type AccountFormState = { error: string | null };

const schema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Informe um nome.").max(80),
    type: z.enum(["checking", "credit_card"]),
    institution: z.string().trim().max(80).optional(),
    owner_member_id: z.uuid().optional(),
    initial_balance: z.string().optional(),
    credit_limit: z.string().optional(),
    closing_day: z.coerce.number().int().min(1).max(31).optional(),
    due_day: z.coerce.number().int().min(1).max(31).optional(),
  })
  .refine((v) => v.type !== "credit_card" || (v.closing_day && v.due_day), {
    message: "Informe os dias de fechamento e vencimento do cartão.",
  });

function formEntries(formData: FormData): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "") entries[key] = value;
  }
  return entries;
}

export async function saveAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = schema.safeParse(formEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;
  const { supabase, householdId } = await getAppContext();

  const initial = input.initial_balance ? parseMoneyToCents(input.initial_balance) : 0;
  if (initial === null) return { error: "Saldo inicial inválido." };
  const limit = input.credit_limit ? parseMoneyToCents(input.credit_limit) : null;
  if (input.credit_limit && (limit === null || limit < 0)) return { error: "Limite inválido." };

  const isCard = input.type === "credit_card";
  const values = {
    name: input.name,
    institution: input.institution ?? null,
    owner_member_id: input.owner_member_id ?? null,
    initial_balance_cents: initial,
    credit_limit_cents: isCard ? limit : null,
    closing_day: isCard ? (input.closing_day ?? null) : null,
    due_day: isCard ? (input.due_day ?? null) : null,
  };

  const { data, error } = input.id
    ? await supabase.from("accounts").update(values).eq("id", input.id).select("id").single()
    : await supabase
        .from("accounts")
        .insert({ ...values, type: input.type, household_id: householdId })
        .select("id")
        .single();
  if (error) return { error: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/", "layout");
  redirect(`/contas/${data.id}`);
}

export async function setAccountArchived(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  const { supabase } = await getAppContext();
  const { error } = await supabase.from("accounts").update({ archived }).eq("id", id);
  if (error) throw new Error(`Não foi possível atualizar a conta: ${error.message}`);
  revalidatePath("/", "layout");
  redirect(archived ? "/contas" : `/contas/${id}`);
}
