import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { corStatus, STATUS_PROJETO } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function criarProjeto(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("projetos").insert({
    nome: formData.get("nome") as string,
    descricao: (formData.get("descricao") as string) || null,
    status: (formData.get("status") as string) || "Planejado",
    conclusao_prevista: (formData.get("conclusao") as string) || null,
    created_by: user?.id,
  });
  revalidatePath("/projetos");
}

export default async function ProjetosPage() {
  const supabase = await createClient();
  const { data: projetos } = await supabase
    .from("projetos")
    .select("*, tarefas(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">🚀 Projetos</h1>

      <form action={criarProjeto} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input name="nome" required placeholder="Nome do projeto" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        <select name="status" defaultValue="Planejado" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
          {STATUS_PROJETO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input name="conclusao" type="date" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
        <input name="descricao" placeholder="Descrição (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Adicionar</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(projetos ?? []).map((p: any) => (
          <div key={p.id} className="rounded-xl border bg-white p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-semibold">{p.nome}</h2>
              <span className={`badge shrink-0 ${corStatus[p.status]}`}>{p.status}</span>
            </div>
            {p.descricao && <p className="mb-2 text-sm text-slate-600">{p.descricao}</p>}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{p.tarefas?.[0]?.count ?? 0} tarefa(s)</span>
              {p.conclusao_prevista && <span>📅 {new Date(p.conclusao_prevista).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
        ))}
        {(!projetos || projetos.length === 0) && <p className="text-slate-400">Nenhum projeto ainda.</p>}
      </div>
    </div>
  );
}
