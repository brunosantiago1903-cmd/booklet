"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificarProfile } from "@/lib/notify";

export async function criarTarefa(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const responsavel_id = (formData.get("responsavel_id") as string) || null;
  const titulo = formData.get("titulo") as string;
  const prazo = (formData.get("prazo") as string) || null;
  const prioridade = (formData.get("prioridade") as string) || "Médio";

  const { data: tarefa } = await supabase
    .from("tarefas")
    .insert({
      titulo,
      descricao: (formData.get("descricao") as string) || null,
      categoria: (formData.get("categoria") as string) || "Suporte",
      prioridade,
      status: "A fazer",
      prazo: prazo ? new Date(prazo).toISOString() : null,
      projeto_id: (formData.get("projeto_id") as string) || null,
      responsavel_id,
      created_by: user.id,
    })
    .select()
    .single();

  // Notifica o responsável (push + WhatsApp) se houver e não for o próprio criador
  if (tarefa && responsavel_id && responsavel_id !== user.id) {
    await notificarProfile(responsavel_id, {
      titulo: `Nova tarefa [${prioridade}]`,
      corpo: titulo + (prazo ? ` — prazo ${new Date(prazo).toLocaleDateString("pt-BR")}` : ""),
      link: `/tarefas`,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath("/");
}

export async function mudarStatus(id: string, status: string) {
  const supabase = await createClient();
  await supabase.from("tarefas").update({ status }).eq("id", id);
  revalidatePath("/tarefas");
  revalidatePath("/");
}

export async function atribuir(id: string, responsavel_id: string, titulo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("tarefas").update({ responsavel_id }).eq("id", id);
  if (responsavel_id && responsavel_id !== user?.id) {
    await notificarProfile(responsavel_id, {
      titulo: "Tarefa atribuída a você",
      corpo: titulo,
      link: "/tarefas",
    });
  }
  revalidatePath("/tarefas");
}
