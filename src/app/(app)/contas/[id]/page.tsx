import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardSummaryView, payBillHref } from "@/components/card-summary";
import { ArrowsIcon, PlusIcon } from "@/components/icons";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionList } from "@/components/transaction-list";
import { Badge, Card, cx, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { dueDateOf, summarizeCard } from "@/lib/cards";
import { getAccount, listAccounts, listCardInvoices, listCategories, listTransactions } from "@/lib/data";
import { formatDateBR, formatMonthBR, isMonthKey, monthKeyOf, monthRange, todayISO } from "@/lib/dates";
import { monthFromParam, stringParam } from "@/lib/month-param";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Conta" };

export default async function AccountPage({ params, searchParams }: PageProps<"/contas/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await getAppContext();
  const account = await getAccount(supabase, id);
  if (!account) notFound();

  const [accounts, categories] = await Promise.all([
    listAccounts(supabase, { includeArchived: true }),
    listCategories(supabase),
  ]);
  const ctx = {
    categories: new Map(categories.map((c) => [c.id, c])),
    accounts: new Map(accounts.map((a) => [a.id, { name: a.name, type: a.type }])),
  };
  const today = todayISO();

  const header = (
    <PageHeader
      title={account.name}
      back="/contas"
      action={
        <Link href={`/contas/${id}/editar`} className="text-sm font-medium text-accent-text">
          Editar
        </Link>
      }
    />
  );

  if (account.type === "checking") {
    const month = monthFromParam(query.mes);
    const { start, end } = monthRange(month);
    const transactions = await listTransactions(supabase, { start, end, accountId: id, limit: 1000 });
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card className="px-4 py-5">
          <p className="text-sm text-ink-2">Saldo atual</p>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatCents(account.balance_cents)}</p>
          {account.archived && (
            <p className="mt-2">
              <Badge>Arquivada</Badge>
            </p>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <LinkButton href={`/lancamentos/novo?conta=${id}`} variant="secondary">
            <PlusIcon size={18} /> Lançamento
          </LinkButton>
          <LinkButton href={`/lancamentos/novo?tipo=transfer&conta=${id}`} variant="secondary">
            <ArrowsIcon size={18} /> Transferir
          </LinkButton>
        </div>
        <div className="flex justify-center">
          <MonthSwitcher month={month} basePath={`/contas/${id}`} />
        </div>
        {transactions.length > 0 ? (
          <TransactionList transactions={transactions} ctx={ctx} />
        ) : (
          <Card>
            <EmptyState title="Sem lançamentos neste mês" />
          </Card>
        )}
      </div>
    );
  }

  // Cartão de crédito: navegação por fatura.
  const invoices = await listCardInvoices(supabase, [id]);
  const summary = summarizeCard({
    closingDay: account.closing_day ?? 1,
    dueDay: account.due_day ?? 10,
    balanceCents: account.balance_cents,
    creditLimitCents: account.credit_limit_cents,
    invoices,
    today,
  });
  const requested = stringParam(query.fatura);
  const selectedMonth = requested && isMonthKey(requested) ? requested : monthKeyOf(summary.openInvoiceMonth);
  const selectedInvoice = `${selectedMonth}-01`;
  const transactions = await listTransactions(supabase, { accountId: id, invoiceMonth: selectedInvoice, limit: 1000 });
  const totals = invoices.find((i) => i.invoice_month === selectedInvoice);
  const months = Array.from(
    new Set([summary.openInvoiceMonth, summary.closedInvoiceMonth, ...invoices.map((i) => i.invoice_month)]),
  )
    .sort()
    .reverse()
    .slice(0, 18);

  return (
    <div className="flex flex-col gap-4">
      {header}
      <Card className="p-4">
        <CardSummaryView card={account} summary={summary} />
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <LinkButton href={`/lancamentos/novo?conta=${id}`} variant="secondary">
          <PlusIcon size={18} /> Compra
        </LinkButton>
        <LinkButton href={payBillHref(id, summary)} variant="secondary">
          <ArrowsIcon size={18} /> Pagar fatura
        </LinkButton>
      </div>

      <nav aria-label="Faturas" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {months.map((month) => {
            const key = monthKeyOf(month);
            const active = key === selectedMonth;
            return (
              <li key={key}>
                <Link
                  href={`/contas/${id}?fatura=${key}`}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "block whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium",
                    active ? "border-accent bg-accent-track text-accent-text" : "border-line bg-surface text-ink-2",
                  )}
                >
                  {formatMonthBR(key, { short: true })}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Card className="grid grid-cols-3 gap-2 p-4 text-sm">
        <div>
          <p className="text-xs text-ink-2">Compras</p>
          <p className="tabular font-semibold">{formatCents(totals?.charges_cents ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-2">Pagamentos</p>
          <p className="tabular font-semibold">{formatCents(totals?.payments_cents ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-2">Vencimento</p>
          <p className="tabular font-semibold">
            {account.due_day ? formatDateBR(dueDateOf(selectedInvoice, account.due_day)) : "—"}
          </p>
        </div>
      </Card>

      {transactions.length > 0 ? (
        <TransactionList transactions={transactions} ctx={ctx} />
      ) : (
        <Card>
          <EmptyState title={`Nada na fatura de ${formatMonthBR(selectedMonth)}`} />
        </Card>
      )}
    </div>
  );
}
