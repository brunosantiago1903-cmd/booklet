import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AlertIcon, CheckIcon, ChevronRightIcon, RefreshIcon } from "@/components/icons";
import { Card, CardHeader, Field, inputClass, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listBankConnections, listMembers } from "@/lib/data";
import { createConnection, syncNow } from "../actions";

export const metadata: Metadata = { title: "Open Finance" };
// Conectar e sincronizar busca até 12 meses de histórico.
export const maxDuration = 300;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export default async function ConnectionsPage() {
  const { supabase } = await getAppContext();
  const [connections, members] = await Promise.all([listBankConnections(supabase), listMembers(supabase)]);
  const memberName = new Map(members.map((m) => [m.id, m.display_name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Open Finance" back="/mais" />

      {connections.length > 0 && (
        <Card>
          <CardHeader title="Conexões" subtitle="Sincronizam sozinhas todo dia às 7h." />
          <ul className="mt-2 divide-y divide-line">
            {connections.map((connection) => (
              <li key={connection.id} className="flex flex-col gap-3 px-4 py-4">
                <Link href={`/mais/conexoes/${connection.id}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{connection.label}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-2">
                      {connection.last_sync_status === "error" ? (
                        <>
                          <AlertIcon size={13} className="text-critical-text" /> Falhou: {connection.last_error}
                        </>
                      ) : connection.last_synced_at ? (
                        <>
                          <CheckIcon size={13} className="text-good-text" /> Sincronizado em{" "}
                          {formatDateTime(connection.last_synced_at)}
                        </>
                      ) : (
                        "Ainda não sincronizado"
                      )}
                      {connection.member_id ? ` · ${memberName.get(connection.member_id) ?? ""}` : ""}
                    </p>
                  </div>
                  <ChevronRightIcon size={18} className="text-muted" />
                </Link>
                <ActionForm action={syncNow} submitLabel={<><RefreshIcon size={16} /> Sincronizar agora</>} pendingText="Sincronizando…" variant="secondary">
                  <input type="hidden" name="id" value={connection.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-base font-semibold">Conectar banco pelo Meu Pluggy</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
          <li>
            Crie uma conta em <span className="text-ink">dashboard.pluggy.ai</span>, crie um time e uma aplicação. Anote o{" "}
            <strong className="text-ink">Client ID</strong> e o <strong className="text-ink">Client Secret</strong>.
          </li>
          <li>
            Ainda no período de teste da Pluggy, entre em <span className="text-ink">meu.pluggy.ai</span> com o seu CPF e
            conecte seus bancos e cartões pelo Open Finance.
          </li>
          <li>
            Na aplicação da Pluggy, conecte o item do Meu Pluggy e copie o <strong className="text-ink">Item ID</strong>.
          </li>
          <li>Cole os dados abaixo. Cada pessoa do casal conecta o próprio CPF com as próprias credenciais.</li>
        </ol>
        <p className="mt-2 text-xs text-muted">
          O uso pessoal do Meu Pluggy é gratuito segundo a Pluggy; confira as condições atuais no site deles. O Client
          Secret é guardado criptografado e nunca volta para o navegador.
        </p>

        <ActionForm action={createConnection} submitLabel="Conectar e importar" pendingText="Conectando e importando…" className="mt-4">
          <Field label="Nome" htmlFor="label" hint="Ex.: Bancos da Ana">
            <input id="label" name="label" required maxLength={60} className={inputClass()} />
          </Field>
          <Field label="Client ID" htmlFor="client_id">
            <input id="client_id" name="client_id" required autoComplete="off" className={inputClass("font-mono text-sm")} />
          </Field>
          <Field label="Client Secret" htmlFor="client_secret">
            <input
              id="client_secret"
              name="client_secret"
              type="password"
              required
              autoComplete="off"
              className={inputClass("font-mono text-sm")}
            />
          </Field>
          <Field label="Item ID" htmlFor="item_id">
            <input id="item_id" name="item_id" required autoComplete="off" className={inputClass("font-mono text-sm")} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
