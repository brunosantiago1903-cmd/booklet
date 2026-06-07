import { createClient } from "@/lib/supabase/server";
import { corPrioridade, situacaoPrazo } from "@/lib/constants";
import NovaTarefa from "./NovaTarefa";
import StatusSelect from "./StatusSelect";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const supabase = await createClient();

  const [{ data: tarefas }, { data: equipe }, { data: projetos }] = await Promise.all([
    supabase
      .from("tarefas")
      .select("*, responsavel:responsavel_id(nome), projeto:projeto_id(nome)")
      .order("prazo", { ascending: true, nullsFirst: false }),
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">✅ Tarefas</h1>
      </div>

      <NovaTarefa equipe={equipe ?? []} projetos={projetos ?? []} />

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Tarefa</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Prazo</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(tarefas ?? []).map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{t.titulo}</p>
                  {t.projeto && <p className="text-xs text-slate-500">🚀 {t.projeto.nome}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${corPrioridade[t.prioridade]}`}>{t.prioridade}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.prazo ? new Date(t.prazo).toLocaleDateString("pt-BR") : "—"}
                  <span className="ml-1 text-xs text-slate-400">{situacaoPrazo(t.prazo, t.status)}</span>
                </td>
                <td className="px-4 py-3">{t.responsavel?.nome ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusSelect id={t.id} status={t.status} />
                </td>
              </tr>
            ))}
            {(!tarefas || tarefas.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhuma tarefa ainda. Crie a primeira acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
