import Link from "next/link";
import { CardSummaryView } from "@/components/card-summary";
import { AlertIcon, FileIcon } from "@/components/icons";
import { MonthSwitcher } from "@/components/month-switcher";
import { SpendingBars } from "@/components/spending-bars";
import { TransactionList } from "@/components/transaction-list";
import { Card, CardHeader, EmptyState, LinkButton, Notice } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { summarizeCard } from "@/lib/cards";
import {
  countUncategorized,
  listAccounts,
  listBankConnections,
  listBudgets,
  listCardInvoices,
  listCategories,
  listTransactions,
} from "@/lib/data";
import { monthRange, todayISO } from "@/lib/dates";
import { monthFromParam } from "@/lib/month-param";
import { formatCents } from "@/lib/money";
import { summarizeMonth } from "@/lib/reports";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { supabase, member } = await getAppContext();
  const params = await searchParams;
  const month = monthFromParam(params.mes);
  const { start, end } = monthRange(month);
  const today = todayISO();

  const [accounts, categories, monthTxs, recent, budgets, uncategorized, connections, pendingReceipts] =
    await Promise.all([
      listAccounts(supabase),
      listCategories(supabase),
      listTransactions(supabase, { start, end, limit: 5000 }),
      listTransactions(supabase, { limit: 6 }),
      listBudgets(supabase),
      countUncategorized(supabase, start, end),
      listBankConnections(supabase),
      supabase.from("receipts").select("id", { count: "exact", head: true }).eq("status", "extracted"),
    ]);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const summary = summarizeMonth(
    monthTxs.map((t) => ({ type: t.type, amountCents: t.amount_cents, categoryId: t.category_id })),
    categoriesById,
  );
  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.amount_cents]));
  const spendingRows = summary.spendingByCategory.map((row) => ({
    ...row,
    budgetCents: row.categoryId ? (budgetByCategory.get(row.categoryId) ?? null) : null,
  }));
  // Categorias com orçamento e sem gasto também aparecem (0%).
  for (const budget of budgets) {
    const category = categoriesById.get(budget.category_id);
    if (category && !spendingRows.some((r) => r.categoryId === budget.category_id)) {
      spendingRows.push({ categoryId: budget.category_id, name: category.name, cents: 0, budgetCents: budget.amount_cents });
    }
  }

  const checking = accounts.filter((a) => a.type === "checking");
  const cards = accounts.filter((a) => a.type === "credit_card");
  const totalBalance = checking.reduce((sum, a) => sum + a.balance_cents, 0);
  const invoices = await listCardInvoices(supabase, cards.map((c) => c.id));
  const accountsById = new Map(accounts.map((a) => [a.id, { name: a.name, type: a.type }]));
  const failedConnections = connections.filter((c) => c.last_sync_status === "error");
  const receiptsToReview = pendingReceipts.count ?? 0;

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <header className="pt-2">
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {member.display_name}</h1>
        </header>
        <Card>
          <EmptyState
            title="Vamos começar"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <LinkButton href="/contas/nova">Cadastrar conta ou cartão</LinkButton>
                <LinkButton href="/mais/conexoes" variant="secondary">
                  Conectar banco (Open Finance)
                </LinkButton>
              </div>
            }
          >
            Cadastre a conta corrente e os cartões de vocês, ou conecte o Meu Pluggy para importar tudo do banco
            automaticamente.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {member.display_name}</h1>
        <MonthSwitcher month={month} basePath="/" />
      </header>

      <Card className="px-4 py-5">
        <p className="text-sm text-ink-2">Saldo nas contas</p>
        <p className="tabular mt-1 text-[2.75rem] font-semibold leading-none tracking-tight">
          {formatCents(totalBalance)}
        </p>
        <p className="mt-2 text-xs text-ink-2">
          {checking.length} {checking.length === 1 ? "conta" : "contas"} · saldo considerando todos os lançamentos
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Receitas" cents={summary.incomeCents} />
        <Kpi label="Despesas" cents={summary.expenseCents} />
        <Kpi label="Resultado" cents={summary.balanceCents} signed />
      </div>

      {(uncategorized > 0 || receiptsToReview > 0 || failedConnections.length > 0) && (
        <div className="flex flex-col gap-2">
          {receiptsToReview > 0 && (
            <Notice tone="info">
              <Link href="/comprovantes" className="font-medium hover:underline">
                <FileIcon size={14} className="mr-1 inline" />
                {receiptsToReview} {receiptsToReview === 1 ? "comprovante lido" : "comprovantes lidos"} aguardando sua
                confirmação
              </Link>
            </Notice>
          )}
          {uncategorized > 0 && (
            <Notice tone="warning">
              <Link href={`/lancamentos?mes=${month}&sem_categoria=1`} className="font-medium hover:underline">
                {uncategorized} {uncategorized === 1 ? "lançamento" : "lançamentos"} sem categoria neste mês
              </Link>
            </Notice>
          )}
          {failedConnections.map((connection) => (
            <Notice tone="error" key={connection.id}>
              <Link href="/mais/conexoes" className="font-medium hover:underline">
                <AlertIcon size={14} className="mr-1 inline" />
                Falha ao sincronizar “{connection.label}”
              </Link>
            </Notice>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <Card>
          <CardHeader title="Cartões" />
          <div className="flex flex-col divide-y divide-line">
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

      <Card>
        <CardHeader
          title="Gastos por categoria"
          subtitle="Barra = gasto no mês · traço = orçamento"
          action={
            <Link href="/categorias" className="text-sm font-medium text-accent-text">
              Orçamentos
            </Link>
          }
        />
        <div className="px-4 pb-4 pt-3">
          {spendingRows.length > 0 ? (
            <SpendingBars
              rows={spendingRows}
              hrefFor={(categoryId) =>
                categoryId
                  ? `/lancamentos?mes=${month}&categoria=${categoryId}`
                  : `/lancamentos?mes=${month}&sem_categoria=1`
              }
            />
          ) : (
            <p className="py-4 text-center text-sm text-ink-2">Nenhuma despesa neste mês.</p>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold">Últimos lançamentos</h2>
          <Link href="/lancamentos" className="text-sm font-medium text-accent-text">
            Ver todos
          </Link>
        </div>
        {recent.length > 0 ? (
          <TransactionList transactions={recent} ctx={{ categories: categoriesById, accounts: accountsById }} />
        ) : (
          <Card>
            <EmptyState title="Nenhum lançamento ainda">
              Envie um comprovante pelo botão + ou conecte o banco em Mais → Open Finance.
            </EmptyState>
          </Card>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, cents, signed = false }: { label: string; cents: number; signed?: boolean }) {
  const negative = signed && cents < 0;
  return (
    <Card className="px-3 py-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 text-[0.95rem] font-semibold leading-tight tracking-tight sm:text-lg">
        {negative ? "−" : ""}
        {formatCents(Math.abs(cents))}
      </p>
      {signed && cents !== 0 && (
        <p className={`mt-1 flex items-center gap-1 text-[11px] ${negative ? "text-critical-text" : "text-good-text"}`}>
          {negative ? <AlertIcon size={12} /> : null}
          {negative ? "gastou mais do que recebeu" : "sobrou no mês"}
        </p>
      )}
    </Card>
  );
}
