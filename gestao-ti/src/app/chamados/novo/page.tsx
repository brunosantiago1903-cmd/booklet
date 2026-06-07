import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PRIORIDADES, CATEGORIAS } from "@/lib/constants";

async function abrirChamado(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .insert({
      titulo: formData.get("titulo") as string,
      descricao: (formData.get("descricao") as string) || null,
      solicitante_nome: formData.get("nome") as string,
      solicitante_contato: (formData.get("contato") as string) || null,
      setor: (formData.get("setor") as string) || null,
      categoria: (formData.get("categoria") as string) || "Suporte",
      prioridade: (formData.get("prioridade") as string) || "Médio",
    })
    .select("protocolo")
    .single();

  if (error) redirect("/chamados/novo?erro=1");
  redirect(`/chamados/novo?ok=${data!.protocolo}`);
}

export default async function NovoChamado({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;

  if (sp.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
            ✅
          </div>
          <h1 className="text-xl font-bold">Chamado registrado!</h1>
          <p className="mt-2 text-sm text-slate-600">
            Seu protocolo é <span className="font-mono font-semibold">{sp.ok}</span>. A equipe de TI foi notificada.
          </p>
          <a href="/chamados/novo" className="mt-4 inline-block text-sm text-brand underline">
            Abrir outro chamado
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={abrirChamado} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">📥 Abrir chamado — TI Morretes</h1>
          <p className="text-sm text-slate-500">Descreva seu problema. A equipe de TI vai atender conforme a prioridade.</p>
        </div>

        {sp.erro && <p className="text-sm text-red-600">Não foi possível registrar. Tente novamente.</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <input name="nome" required placeholder="Seu nome *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="setor" placeholder="Setor / secretaria" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <input name="contato" placeholder="Telefone ou e-mail para retorno" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="titulo" required placeholder="Assunto *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea name="descricao" rows={4} placeholder="Descreva o problema com detalhes" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <div className="grid gap-4 md:grid-cols-2">
          <select name="categoria" defaultValue="Suporte" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select name="prioridade" defaultValue="Médio" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            {PRIORIDADES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <button className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Enviar chamado
        </button>
      </form>
    </main>
  );
}
