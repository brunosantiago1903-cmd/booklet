import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUser, hashSenha } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function criarUsuario(formData: FormData) {
  "use server";
  const atual = await getUser();
  if (atual?.papel !== "gestor") return; // só gestor cadastra

  const nome = String(formData.get("nome") || "");
  const email = String(formData.get("email") || "");
  const senha = String(formData.get("senha") || "");
  const cargo = (formData.get("cargo") as string) || null;
  const papel = (formData.get("papel") as string) || "tecnico";
  const telefone = (formData.get("telefone") as string) || null;
  if (!nome || !email || senha.length < 6) return;

  await sql`
    insert into usuarios (nome, email, senha_hash, cargo, papel, telefone)
    values (${nome}, ${email}, ${hashSenha(senha)}, ${cargo}, ${papel}::papel, ${telefone})
    on conflict (email) do nothing
  `;
  revalidatePath("/equipe");
}

type M = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  papel: string;
  telefone: string | null;
  carga: number;
};

export default async function EquipePage() {
  const atual = await getUser();
  const equipe = await sql<M[]>`
    select u.id, u.nome, u.email, u.cargo, u.papel, u.telefone,
           count(t.id) filter (where t.status <> 'Concluído')::int as carga
    from usuarios u
    left join tarefas t on t.responsavel_id = u.id
    where u.ativo
    group by u.id
    order by u.nome
  `;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">👥 Equipe</h1>

      {atual?.papel === "gestor" && (
        <form action={criarUsuario} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
          <p className="text-sm font-semibold md:col-span-3">Cadastrar membro</p>
          <input name="nome" required placeholder="Nome *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" type="email" required placeholder="E-mail *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="senha" type="password" required placeholder="Senha (mín. 6) *" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="cargo" placeholder="Cargo" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="telefone" placeholder="WhatsApp (5541999999999)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="papel" defaultValue="tecnico" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="tecnico">Técnico</option>
            <option value="gestor">Gestor</option>
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark md:col-span-3">
            Adicionar membro
          </button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {equipe.map((m) => (
          <div key={m.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{m.nome}</h2>
              <span className="badge bg-slate-200 text-slate-700">{m.papel}</span>
            </div>
            <p className="text-sm text-slate-600">{m.cargo}</p>
            <p className="text-xs text-slate-400">{m.email}</p>
            {m.telefone && <p className="text-xs text-slate-400">📱 {m.telefone}</p>}
            <p className="mt-2 text-sm">
              <span className="font-semibold">{m.carga}</span> tarefa(s) em aberto
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
