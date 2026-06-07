import { sql } from "@/lib/db";
import { corPrioridade, situacaoPrazo } from "@/lib/constants";
import NovaTarefa from "./NovaTarefa";
import StatusSelect from "./StatusSelect";

export const dynamic = "force-dynamic";

type LinhaTarefa = {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  responsavel_nome: string | null;
  projeto_nome: string | null;
};

export default async function TarefasPage() {
  const [tarefas, equipe, projetos] = await Promise.all([
    sql<LinhaTarefa[]>`
      select t.id, t.titulo, t.prioridade, t.status, t.prazo,
             u.nome as responsavel_nome, p.nome as projeto_nome
      from tarefas t
      left join usuarios u on u.id = t.responsavel_id
      left join projetos p on p.id = t.projeto_id
      order by t.prazo asc nulls last, t.created_at desc
    `,
    sql<{ id: string; nome: string }[]>`select id, nome from usuarios where ativo order by nome`,
    sql<{ id: string; nome: string }[]>`select id, nome from projetos order by nome`,
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">✅ Tarefas</h1>

      <NovaTarefa equipe={equipe} projetos={projetos} />

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
            {tarefas.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{t.titulo}</p>
                  {t.projeto_nome && <p className="text-xs text-slate-500">🚀 {t.projeto_nome}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${corPrioridade[t.prioridade]}`}>{t.prioridade}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.prazo ? new Date(t.prazo).toLocaleDateString("pt-BR") : "—"}
                  <span className="ml-1 text-xs text-slate-400">{situacaoPrazo(t.prazo, t.status)}</span>
                </td>
                <td className="px-4 py-3">{t.responsavel_nome ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusSelect id={t.id} status={t.status} />
                </td>
              </tr>
            ))}
            {tarefas.length === 0 && (
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
