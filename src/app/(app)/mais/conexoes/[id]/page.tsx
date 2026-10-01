import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { RefreshIcon, TrashIcon } from "@/components/icons";
import { InlineForm } from "@/components/inline-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, inputClass, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listAccounts } from "@/lib/data";
import { deleteConnection, syncNow, updateLink } from "../../actions";

export const metadata: Metadata = { title: "Conexão" };
export const maxDuration = 300;

export default async function ConnectionPage({ params }: PageProps<"/mais/conexoes/[id]">) {
  const { id } = await params;
  const { supabase } = await getAppContext();
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("id, label, item_id, last_synced_at, last_sync_status, last_error")
    .eq("id", id)
    .maybeSingle();
  if (!connection) notFound();

  const [{ data: links }, accounts] = await Promise.all([
    supabase
      .from("bank_account_links")
      .select("id, external_name, external_type, external_subtype, account_id")
      .eq("connection_id", id)
      .order("external_name"),
    listAccounts(supabase, { includeArchived: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={connection.label} back="/mais/conexoes" />

      <Card>
        <CardHeader
          title="Contas encontradas no banco"
          subtitle="Escolha em qual conta do app cada uma entra, ou ignore."
        />
        <ul className="mt-2 divide-y divide-line">
          {(links ?? []).map((link) => {
            const isCard = link.external_type === "CREDIT";
            const compatible = accounts.filter((a) => (isCard ? a.type === "credit_card" : a.type === "checking"));
            return (
              <li key={link.id} className="flex flex-col gap-2 px-4 py-3">
                <p className="text-sm font-medium">
                  {link.external_name}{" "}
                  <span className="text-ink-2">· {isCard ? "cartão de crédito" : "conta"}</span>
                </p>
                <InlineForm action={updateLink} submitLabel="Salvar">
                  <input type="hidden" name="link_id" value={link.id} />
                  <select
                    name="account_id"
                    defaultValue={link.account_id ?? ""}
                    aria-label={`Destino de ${link.external_name}`}
                    className={inputClass("flex-1 text-sm")}
                  >
                    <option value="">Não importar</option>
                    {compatible.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </InlineForm>
              </li>
            );
          })}
          {(links ?? []).length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-2">Nenhuma conta encontrada ainda. Sincronize para buscar.</li>
          )}
        </ul>
      </Card>

      <Card className="p-4">
        <ActionForm action={syncNow} submitLabel={<><RefreshIcon size={16} /> Sincronizar agora</>} pendingText="Sincronizando…" variant="secondary">
          <input type="hidden" name="id" value={connection.id} />
          <p className="text-xs text-muted">Item ID: {connection.item_id}</p>
        </ActionForm>
      </Card>

      <form action={deleteConnection}>
        <input type="hidden" name="id" value={connection.id} />
        <SubmitButton variant="ghost" pendingText="Removendo…" className="w-full text-critical-text">
          <TrashIcon size={18} /> Remover conexão (mantém lançamentos e contas)
        </SubmitButton>
      </form>
    </div>
  );
}
