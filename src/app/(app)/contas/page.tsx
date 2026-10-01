import type { Metadata } from "next";
import Link from "next/link";
import { CardSummaryView } from "@/components/card-summary";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { summarizeCard } from "@/lib/cards";
import { listAccounts, listCardInvoices, listMembers } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Contas e cartões" };

export default async function AccountsPage() {
  const { supabase } = await getAppContext();
  const [accounts, members] = await Promise.all([
    listAccounts(supabase, { includeArchived: true }),
    listMembers(supabase),
  ]);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const checking = active.filter((a) => a.type === "checking");
  const cards = active.filter((a) => a.type === "credit_card");
  const invoices = await listCardInvoices(supabase, cards.map((c) => c.id));
  const memberName = new Map(members.map((m) => [m.id, m.display_name]));
  const today = todayISO();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contas e cartões"
        action={
          <LinkButton href="/contas/nova" className="px-3">
            <PlusIcon size={18} /> Nova
          </LinkButton>
        }
      />

      {active.length === 0 && (
        <Card>
          <EmptyState title="Nenhuma conta cadastrada">
            Cadastre manualmente ou conecte o banco em Mais → Open Finance para criar as contas automaticamente.
          </EmptyState>
        </Card>
      )}

      {checking.length > 0 && (
        <Card>
          <CardHeader
            title="Contas"
            subtitle={`Total ${formatCents(checking.reduce((s, a) => s + a.balance_cents, 0))}`}
          />
          <ul className="mt-2 divide-y divide-line">
            {checking.map((account) => (
              <li key={account.id}>
                <Link href={`/contas/${account.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-ink-2">
                      {[account.institution, account.owner_member_id ? memberName.get(account.owner_member_id) : "Do casal"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="tabular font-semibold">{formatCents(account.balance_cents)}</span>
                  <ChevronRightIcon size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {cards.length > 0 && (
        <Card>
          <CardHeader title="Cartões de crédito" />
          <div className="mt-1 flex flex-col divide-y divide-line">
            {cards.map((card) => (
              <div key={card.id} className="px-4 py-4">
                <CardSummaryView
                  card={card}
                  summary={summarizeCard({
                    closingDay: card.closing_day ?? 1,
                    dueDay: card.due_day ?? 10,
                    balanceCents: card.balance_cents,
                    creditLimitCents: card.credit_limit_cents,
                    invoices: invoices.filter((i) => i.account_id === card.id),
                    today,
                  })}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {archived.length > 0 && (
        <Card>
          <CardHeader title="Arquivadas" subtitle="Não aparecem nos formulários nem no saldo do painel." />
          <ul className="mt-2 divide-y divide-line">
            {archived.map((account) => (
              <li key={account.id}>
                <Link href={`/contas/${account.id}`} className="flex items-center justify-between px-4 py-3 text-ink-2 hover:bg-surface-2">
                  <span>{account.name}</span>
                  <span className="tabular">{formatCents(account.balance_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
