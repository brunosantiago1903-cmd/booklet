"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeAiError } from "@/lib/ai/client";
import { extractReceipt, isSupportedReceiptType } from "@/lib/ai/extract-receipt";
import { getAppContext } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/categories";
import { listAccounts, listCategories, listMembers } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";

const RECEIPT_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|pdf)$/;

export async function registerReceipt(input: {
  path: string;
  mimeType: string;
  fileName: string | null;
}): Promise<{ id: string } | { error: string }> {
  const { supabase, member, householdId } = await getAppContext();
  if (!RECEIPT_PATH_RE.test(input.path) || !input.path.startsWith(`${householdId}/`)) {
    return { error: "Caminho de arquivo inválido." };
  }
  if (!isSupportedReceiptType(input.mimeType)) {
    return { error: "Formato não suportado. Envie JPG, PNG, WEBP ou PDF." };
  }
  const { data, error } = await supabase
    .from("receipts")
    .insert({
      household_id: householdId,
      uploaded_by: member.id,
      storage_path: input.path,
      mime_type: input.mimeType,
      file_name: input.fileName?.slice(0, 200) ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: `Não foi possível registrar o comprovante: ${error.message}` };
  revalidatePath("/comprovantes");
  return { id: data.id };
}

/** Lê o comprovante com a IA e guarda o resultado para revisão. */
export async function processReceipt(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await getAppContext();
  if (!isAiConfigured()) {
    return { ok: false, error: "Leitura automática desligada (falta ANTHROPIC_API_KEY). Preencha manualmente." };
  }

  const { data: receipt, error } = await supabase
    .from("receipts")
    .select("id, storage_path, mime_type, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !receipt) return { ok: false, error: "Comprovante não encontrado." };
  if (receipt.status === "confirmed") return { ok: true };

  try {
    const [file, categories, accounts, members] = await Promise.all([
      supabase.storage.from("receipts").download(receipt.storage_path),
      listCategories(supabase),
      listAccounts(supabase),
      listMembers(supabase),
    ]);
    if (file.error || !file.data) throw new Error("Não foi possível abrir o arquivo enviado.");

    const extraction = await extractReceipt({
      bytes: new Uint8Array(await file.data.arrayBuffer()),
      mimeType: receipt.mime_type,
      today: todayISO(),
      memberNames: members.map((m) => m.display_name),
      categories: buildCategoryOptions(categories),
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, institution: a.institution })),
    });

    const { error: updateError } = await supabase
      .from("receipts")
      .update({ status: "extracted", extraction, error: null })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    const message = describeAiError(err);
    await supabase.from("receipts").update({ status: "failed", error: message }).eq("id", id);
    revalidatePath("/comprovantes");
    return { ok: false, error: message };
  }
}

export async function deleteReceipt(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { supabase } = await getAppContext();
  const { data: receipt } = await supabase.from("receipts").select("id, storage_path").eq("id", id).maybeSingle();
  if (receipt) {
    await supabase.storage.from("receipts").remove([receipt.storage_path]);
    const { error } = await supabase.from("receipts").delete().eq("id", id);
    if (error) throw new Error(`Não foi possível excluir: ${error.message}`);
  }
  revalidatePath("/", "layout");
  redirect("/comprovantes");
}
