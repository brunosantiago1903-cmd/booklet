"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { describeAiError } from "@/lib/ai/client";
import { getAppContext } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { encryptionKey, isAiConfigured } from "@/lib/env";
import { ofxToDrafts } from "@/lib/import-drafts";
import { decodeOfx, parseOfx } from "@/lib/ofx";
import { categorizeWithAi } from "@/lib/server/categorize";
import { importTransactions } from "@/lib/server/import";
import { describePluggyError, pluggyClient, refreshConnectionAccounts, syncConnection } from "@/lib/server/pluggy";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error: string | null; ok?: string };

function done(message: string, path = "/", type: "layout" | "page" = "layout"): ActionState {
  revalidatePath(path, type);
  return { error: null, ok: message };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("display_name") ?? "").trim();
  if (!name || name.length > 40) return { error: "Informe um nome de até 40 caracteres." };
  const { supabase, member } = await getAppContext();
  const { error } = await supabase.from("members").update({ display_name: name }).eq("id", member.id);
  if (error) return { error: error.message };
  return done("Nome atualizado.");
}

export async function renameHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Informe um nome de até 60 caracteres." };
  const { supabase, householdId } = await getAppContext();
  const { error } = await supabase.from("households").update({ name }).eq("id", householdId);
  if (error) return { error: error.message };
  return done("Nome da casa atualizado.");
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "A senha precisa ter pelo menos 10 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };
  const { supabase } = await getAppContext();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `Não foi possível trocar a senha: ${error.message}` };
  return { error: null, ok: "Senha alterada." };
}

const connectionSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome à conexão.").max(60),
  client_id: z.string().trim().min(8, "Client ID inválido.").max(200),
  client_secret: z.string().trim().min(8, "Client Secret inválido.").max(500),
  item_id: z.string().trim().min(8, "Item ID inválido.").max(200),
});

export async function createConnection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = connectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;
  const { supabase, member, householdId } = await getAppContext();

  let secretEncrypted: string;
  try {
    secretEncrypted = encryptSecret(input.client_secret, encryptionKey());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "APP_ENCRYPTION_KEY inválida." };
  }

  try {
    // Valida credenciais e item antes de salvar.
    await pluggyClient(input.client_id, input.client_secret).fetchItem(input.item_id);
  } catch (err) {
    return { error: describePluggyError(err) };
  }

  const id = crypto.randomUUID();
  // Sem .select(): o usuário não tem permissão de leitura na coluna do segredo.
  const { error } = await supabase.from("bank_connections").insert({
    id,
    household_id: householdId,
    member_id: member.id,
    label: input.label,
    client_id: input.client_id,
    client_secret_encrypted: secretEncrypted,
    item_id: input.item_id,
  });
  if (error) {
    return { error: error.code === "23505" ? "Este Item ID já está conectado." : error.message };
  }

  const admin = createAdminClient();
  try {
    await refreshConnectionAccounts(admin, id);
  } catch (err) {
    return { error: `Conexão salva, mas não deu para ler as contas: ${describePluggyError(err)}` };
  }
  await syncConnection(admin, id);
  revalidatePath("/", "layout");
  redirect(`/mais/conexoes/${id}`);
}

async function assertConnectionAccess(id: string) {
  const { supabase, householdId } = await getAppContext();
  // A leitura pelo cliente do usuário passa pelo RLS: só conexões do casal.
  const { data } = await supabase.from("bank_connections").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("Conexão não encontrada.");
  return { supabase, householdId };
}

export async function syncNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const { householdId } = await assertConnectionAccess(id);
  const admin = createAdminClient();
  try {
    await refreshConnectionAccounts(admin, id);
  } catch (err) {
    return { error: describePluggyError(err) };
  }
  const result = await syncConnection(admin, id);
  if (result.error) return { error: result.error };

  let categorized = 0;
  if (isAiConfigured() && result.uncategorizedIds.length > 0) {
    try {
      categorized = await categorizeWithAi(admin, householdId, { ids: result.uncategorizedIds, limit: 80 });
    } catch {
      // A categorização é complementar; o cron diário tenta de novo.
    }
  }
  return done(
    `${result.inserted} novos, ${result.updated} atualizados, ${result.linked} vinculados a comprovantes` +
      (categorized ? `, ${categorized} categorizados pela IA` : "") +
      ".",
  );
}

export async function deleteConnection(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { supabase } = await assertConnectionAccess(id);
  const { error } = await supabase.from("bank_connections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/mais/conexoes");
}

export async function updateLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const linkId = String(formData.get("link_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const { supabase } = await getAppContext();
  const { error } = await supabase
    .from("bank_account_links")
    .update({ account_id: accountId || null })
    .eq("id", linkId);
  if (error) return { error: error.message };
  return done(accountId ? "Vínculo salvo." : "Conta ignorada na sincronização.");
}

export async function importOfx(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("file");
  const accountId = String(formData.get("account_id") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo OFX." };
  if (file.size > 4 * 1024 * 1024) return { error: "Arquivo maior que 4 MB." };
  const { supabase, householdId } = await getAppContext();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, closing_day, due_day")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Escolha a conta de destino." };

  const statement = parseOfx(decodeOfx(new Uint8Array(await file.arrayBuffer())));
  if (statement.transactions.length === 0) return { error: "Nenhum lançamento encontrado no arquivo." };
  if (statement.accountType && statement.accountType !== account.type) {
    return {
      error:
        statement.accountType === "credit_card"
          ? "O arquivo é de cartão de crédito, mas a conta escolhida é conta corrente."
          : "O arquivo é de conta corrente, mas a conta escolhida é cartão.",
    };
  }

  try {
    const result = await importTransactions(supabase, {
      householdId,
      accountId,
      source: "ofx",
      drafts: ofxToDrafts(statement, account),
      pendingWindowStart: null,
    });
    let categorized = 0;
    if (isAiConfigured() && result.uncategorizedIds.length > 0) {
      try {
        categorized = await categorizeWithAi(supabase, householdId, { ids: result.uncategorizedIds, limit: 160 });
      } catch {
        // Fica sem categoria; dá para rodar a IA depois.
      }
    }
    const skipped = statement.transactions.length - result.inserted - result.updated - result.linked;
    return done(
      `${result.inserted} importados, ${result.linked} vinculados a lançamentos existentes` +
        (skipped > 0 ? `, ${skipped} já existiam` : "") +
        (categorized ? `, ${categorized} categorizados pela IA` : "") +
        ".",
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha na importação." };
  }
}

export async function categorizeNow(): Promise<ActionState> {
  const { supabase, householdId } = await getAppContext();
  if (!isAiConfigured()) return { error: "Configure ANTHROPIC_API_KEY para usar a IA." };
  try {
    const count = await categorizeWithAi(supabase, householdId, { limit: 160 });
    return done(count > 0 ? `${count} lançamentos categorizados.` : "Nada para categorizar (ou a IA não teve certeza).");
  } catch (err) {
    return { error: describeAiError(err) };
  }
}
