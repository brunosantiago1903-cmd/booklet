import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: equipe } = await supabase.from("profiles").select("*").order("nome");

  // Conta de tarefas abertas por responsável
  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("responsavel_id")
    .neq("status", "Concluído");
  const carga: Record<string, number> = {};
  (tarefas ?? []).forEach((t: any) => {
    if (t.responsavel_id) carga[t.responsavel_id] = (carga[t.responsavel_id] ?? 0) + 1;
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">👥 Equipe</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(equipe ?? []).map((m: any) => (
          <div key={m.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{m.nome || "(sem nome)"}</h2>
              <span className="badge bg-slate-200 text-slate-700">{m.papel}</span>
            </div>
            <p className="text-sm text-slate-600">{m.cargo}</p>
            {m.telefone && <p className="text-xs text-slate-400">📱 {m.telefone}</p>}
            <p className="mt-2 text-sm">
              <span className="font-semibold">{carga[m.id] ?? 0}</span> tarefa(s) em aberto
            </p>
          </div>
        ))}
        {(!equipe || equipe.length === 0) && (
          <p className="text-slate-400">
            Nenhum membro ainda. Crie usuários no painel do Supabase (Authentication → Users); o perfil é gerado automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
