import { sql } from "@/lib/db";
import { corPrioridade } from "@/lib/constants";
import ChamadoStatus from "./ChamadoStatus";

export const dynamic = "force-dynamic";

type C = {
  id: string;
  protocolo: string;
  titulo: string;
  setor: string | null;
  solicitante_nome: string;
  solicitante_contato: string | null;
  prioridade: string;
  status: string;
};

export default async function ChamadosPage() {
  const chamados = await sql<C[]>`
    select id, protocolo, titulo, setor, solicitante_nome, solicitante_contato, prioridade, status
    from chamados order by created_at desc
  `;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📥 Chamados</h1>
        <a href="/chamados/novo" target="_blank" className="text-sm text-brand hover:underline">
          Abrir portal público ↗
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {chamados.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{c.protocolo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{c.titulo}</p>
                  {c.setor && <p className="text-xs text-slate-500">{c.setor}</p>}
                </td>
                <td className="px-4 py-3">
                  {c.solicitante_nome}
                  {c.solicitante_contato && <p className="text-xs text-slate-400">{c.solicitante_contato}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${corPrioridade[c.prioridade]}`}>{c.prioridade}</span>
                </td>
                <td className="px-4 py-3">
                  <ChamadoStatus id={c.id} status={c.status} />
                </td>
              </tr>
            ))}
            {chamados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhum chamado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
