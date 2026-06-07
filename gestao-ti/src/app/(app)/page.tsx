import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { corPrioridade, situacaoPrazo } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Painel() {
  const supabase = await createClient();
  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("*, responsavel:responsavel_id(nome)")
    .neq("status", "Concluído")
    .order("prazo", { ascending: true, nullsFirst: false });
  const { count: chamadosAbertos } = await supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("status", "Aberto");

  const lista = tarefas ?? [];
  const atrasadas = lista.filter((t: any) => situacaoPrazo(t.prazo, t.status) === "🔴 Atrasada");
  const hoje = lista.filter((t: any) => situacaoPrazo(t.prazo, t.status) === "🟡 Hoje");
  const semana = lista.filter((t: any) => situacaoPrazo(t.prazo, t.status) === "🟢 Esta semana");

  const Card = ({ titulo, cor, itens }: { titulo: string; cor: string; itens: any[] }) => (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{titulo}</h2>
        <span className={`badge ${cor}`}>{itens.length}</span>
      </div>
      <ul className="space-y-2">
        {itens.slice(0, 6).map((t: any) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{t.titulo}</span>
            <span className={`badge shrink-0 ${corPrioridade[t.prioridade]}`}>{t.prioridade}</span>
          </li>
        ))}
        {itens.length === 0 && <li className="text-sm text-slate-400">Nada por aqui 🎉</li>}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🗓️ Painel do Dia</h1>
        <Link href="/tarefas" className="text-sm text-brand hover:underline">
          Ver todas as tarefas →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card titulo="🔴 Atrasadas" cor="bg-red-100 text-red-800" itens={atrasadas} />
        <Card titulo="🟡 Hoje" cor="bg-yellow-100 text-yellow-800" itens={hoje} />
        <Card titulo="🟢 Esta semana" cor="bg-green-100 text-green-800" itens={semana} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/chamados" className="rounded-xl border bg-white p-4 hover:bg-slate-50">
          <p className="text-sm text-slate-500">Chamados abertos</p>
          <p className="text-3xl font-bold">{chamadosAbertos ?? 0}</p>
        </Link>
        <Link href="/tarefas" className="rounded-xl border bg-white p-4 hover:bg-slate-50">
          <p className="text-sm text-slate-500">Tarefas em aberto</p>
          <p className="text-3xl font-bold">{lista.length}</p>
        </Link>
      </div>
    </div>
  );
}
