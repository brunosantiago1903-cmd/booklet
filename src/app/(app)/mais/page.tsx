import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { BankIcon, ChevronRightIcon, FileIcon, LogoutIcon, SparklesIcon, TagIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, Field, inputClass, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listMembers } from "@/lib/data";
import { isAiConfigured } from "@/lib/env";
import { signOut } from "../../login/actions";
import { categorizeNow, changePassword, renameHousehold, updateProfile } from "./actions";

export const metadata: Metadata = { title: "Mais" };
export const maxDuration = 60;

export default async function MorePage() {
  const { supabase, member, email, householdId } = await getAppContext();
  const [members, { data: household }] = await Promise.all([
    listMembers(supabase),
    supabase.from("households").select("name").eq("id", householdId).single(),
  ]);

  const links = [
    { href: "/categorias", label: "Categorias, orçamentos e regras", icon: TagIcon },
    { href: "/mais/conexoes", label: "Open Finance (Meu Pluggy)", icon: BankIcon },
    { href: "/mais/importar", label: "Importar extrato OFX", icon: FileIcon },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mais" />

      <Card>
        <ul className="divide-y divide-line">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                <Icon size={20} className="text-ink-2" />
                <span className="flex-1 font-medium">{label}</span>
                <ChevronRightIcon size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <SparklesIcon size={20} className="text-accent-text" />
          <h2 className="text-base font-semibold">Categorização com IA</h2>
        </div>
        {isAiConfigured() ? (
          <ActionForm action={categorizeNow} submitLabel="Categorizar lançamentos sem categoria" pendingText="Categorizando…" variant="secondary">
            <p className="text-sm text-ink-2">
              A IA sugere categorias para até 160 lançamentos por vez. Isso também roda sozinho todo dia, depois da
              sincronização com o banco.
            </p>
          </ActionForm>
        ) : (
          <p className="text-sm text-ink-2">
            Desligada. Configure <code>ANTHROPIC_API_KEY</code> no servidor para ler comprovantes e categorizar
            lançamentos automaticamente.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Casal" subtitle={members.map((m) => m.display_name).join(" e ")} />
        <div className="flex flex-col gap-4 p-4">
          <ActionForm action={renameHousehold} submitLabel="Salvar" variant="secondary">
            <Field label="Nome da casa" htmlFor="household-name">
              <input id="household-name" name="name" defaultValue={household?.name ?? ""} maxLength={60} className={inputClass()} />
            </Field>
          </ActionForm>
          <ActionForm action={updateProfile} submitLabel="Salvar" variant="secondary">
            <Field label="Seu nome" htmlFor="display_name" hint={email}>
              <input
                id="display_name"
                name="display_name"
                defaultValue={member.display_name}
                maxLength={40}
                required
                className={inputClass()}
              />
            </Field>
          </ActionForm>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Trocar senha</h2>
        <ActionForm action={changePassword} submitLabel="Trocar senha" variant="secondary">
          <Field label="Nova senha" htmlFor="new-password">
            <input id="new-password" name="password" type="password" minLength={10} autoComplete="new-password" required className={inputClass()} />
          </Field>
          <Field label="Repita a nova senha" htmlFor="confirm-password">
            <input id="confirm-password" name="confirm" type="password" minLength={10} autoComplete="new-password" required className={inputClass()} />
          </Field>
        </ActionForm>
      </Card>

      <Card className="p-4 text-sm text-ink-2">
        <h2 className="mb-2 text-base font-semibold text-ink">Instalar no celular</h2>
        <p>
          <strong className="text-ink">iPhone:</strong> abra no Safari, toque em Compartilhar → “Adicionar à Tela de
          Início”.
        </p>
        <p className="mt-1">
          <strong className="text-ink">Android:</strong> no Chrome, menu ⋮ → “Instalar app”. Depois disso, o Finanças
          aparece no menu Compartilhar para receber comprovantes.
        </p>
      </Card>

      <form action={signOut}>
        <SubmitButton variant="secondary" pendingText="Saindo…" className="w-full">
          <LogoutIcon size={18} /> Sair
        </SubmitButton>
      </form>
    </div>
  );
}
