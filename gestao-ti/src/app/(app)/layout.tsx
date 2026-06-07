import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sair } from "@/app/auth/actions";
import PushManager from "@/components/PushManager";

const NAV = [
  { href: "/", label: "Painel", icon: "🗓️" },
  { href: "/tarefas", label: "Tarefas", icon: "✅" },
  { href: "/projetos", label: "Projetos", icon: "🚀" },
  { href: "/chamados", label: "Chamados", icon: "📥" },
  { href: "/equipe", label: "Equipe", icon: "👥" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUser();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-white md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 p-4">
          <div className="h-8 w-8 rounded-lg bg-brand" />
          <div>
            <p className="text-sm font-bold leading-tight">Gestão TI</p>
            <p className="text-xs text-slate-500">Morretes</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t p-3 md:block">
          <p className="text-sm font-medium">{usuario.nome}</p>
          <p className="text-xs text-slate-500">{usuario.cargo || usuario.papel}</p>
          <form action={sair}>
            <button className="mt-2 text-xs text-red-600 hover:underline">Sair</button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">{children}</main>
      <PushManager />
    </div>
  );
}
