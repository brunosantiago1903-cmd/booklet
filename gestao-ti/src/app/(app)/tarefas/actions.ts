"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { notificarUsuario } from "@/lib/notify";

export async function criarTarefa(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return;

  const titulo = String(formData.get("titulo") || "");
  const descricao = (formData.get("descricao") as string) || null;
  const categoria = (formData.get("categoria") as string) || "Suporte";
  const prioridade = (formData.get("prioridade") as string) || "Médio";
  const responsavel_id = (formData.get("responsavel_id") as string) || null;
  const projeto_id = (formData.get("projeto_id") as string) || null;
  const prazoRaw = (formData.get("prazo") as string) || "";
  const prazo = prazoRaw ? new Date(prazoRaw).toISOString() : null;

  const [tarefa] = await sql<{ id: string }[]>`
    insert into tarefas (titulo, descricao, categoria, prioridade, status, prazo, projeto_id, responsavel_id, created_by)
    values (${titulo}, ${descricao}, ${categoria}::categoria_ti, ${prioridade}::prioridade, 'A fazer',
            ${prazo}, ${projeto_id}, ${responsavel_id}, ${userId})
    returning id
  `;

  if (tarefa && responsavel_id && responsavel_id !== userId) {
    await notificarUsuario(responsavel_id, {
      titulo: `Nova tarefa [${prioridade}]`,
      corpo: titulo + (prazo ? ` — prazo ${new Date(prazo).toLocaleDateString("pt-BR")}` : ""),
      link: "/tarefas",
    });
  }

  revalidatePath("/tarefas");
  revalidatePath("/");
}

export async function mudarStatus(id: string, status: string) {
  await sql`update tarefas set status = ${status}::status_tarefa where id = ${id}`;
  revalidatePath("/tarefas");
  revalidatePath("/");
}

export async function atribuir(id: string, responsavel_id: string, titulo: string) {
  const userId = await getUserId();
  await sql`update tarefas set responsavel_id = ${responsavel_id} where id = ${id}`;
  if (responsavel_id && responsavel_id !== userId) {
    await notificarUsuario(responsavel_id, {
      titulo: "Tarefa atribuída a você",
      corpo: titulo,
      link: "/tarefas",
    });
  }
  revalidatePath("/tarefas");
}
