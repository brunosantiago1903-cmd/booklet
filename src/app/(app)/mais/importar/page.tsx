import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listAccounts } from "@/lib/data";
import { importOfx } from "../actions";

export const metadata: Metadata = { title: "Importar OFX" };
export const maxDuration = 60;

export default async function ImportPage() {
  const { supabase } = await getAppContext();
  const accounts = await listAccounts(supabase);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Importar extrato" back="/mais" />
      <Card className="p-4">
        <p className="mb-4 text-sm text-ink-2">
          Alternativa ao Open Finance: exporte o extrato da conta ou a fatura do cartão em <strong>OFX</strong> no app ou
          site do banco e envie aqui. Lançamentos repetidos são ignorados e os que você já lançou (ou enviou comprovante)
          são vinculados, sem duplicar.
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-2">Cadastre uma conta primeiro.</p>
        ) : (
          <ActionForm action={importOfx} submitLabel="Importar" pendingText="Importando…">
            <Field label="Conta ou cartão" htmlFor="account_id">
              <select id="account_id" name="account_id" required defaultValue="" className={inputClass()}>
                <option value="" disabled>
                  Escolha…
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.type === "credit_card" ? " (cartão)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Arquivo .ofx" htmlFor="file">
              <input
                id="file"
                name="file"
                type="file"
                accept=".ofx,.OFX,application/x-ofx,application/ofx,text/plain"
                required
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-semibold file:text-ink"
              />
            </Field>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
