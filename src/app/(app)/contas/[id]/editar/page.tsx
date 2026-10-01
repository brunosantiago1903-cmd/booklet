import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { getAccount, listMembers } from "@/lib/data";
import { centsToInput } from "@/lib/money";
import { saveAccount, setAccountArchived } from "../../actions";

export const metadata: Metadata = { title: "Editar conta" };

export default async function EditAccountPage({ params }: PageProps<"/contas/[id]/editar">) {
  const { id } = await params;
  const { supabase } = await getAppContext();
  const [account, members] = await Promise.all([getAccount(supabase, id), listMembers(supabase)]);
  if (!account) notFound();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Editar" back={`/contas/${id}`} />
      <Card className="p-4">
        <AccountForm
          action={saveAccount}
          members={members}
          defaults={{
            id: account.id,
            name: account.name,
            type: account.type,
            institution: account.institution ?? "",
            ownerMemberId: account.owner_member_id ?? "",
            initialBalance: account.initial_balance_cents ? centsToInput(account.initial_balance_cents) : "",
            creditLimit: account.credit_limit_cents ? centsToInput(account.credit_limit_cents) : "",
            closingDay: account.closing_day ? String(account.closing_day) : "",
            dueDay: account.due_day ? String(account.due_day) : "",
          }}
        />
      </Card>
      <Card className="p-4">
        <form action={setAccountArchived} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="archived" value={account.archived ? "false" : "true"} />
          <p className="text-sm text-ink-2">
            {account.archived
              ? "Esta conta está arquivada. Reative para voltar a usá-la."
              : "Arquivar esconde a conta dos formulários e do painel, sem apagar o histórico."}
          </p>
          <SubmitButton variant="secondary">{account.archived ? "Reativar conta" : "Arquivar conta"}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
