import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionList } from "@/components/transaction-list";
import { Card, EmptyState, inputClass, LinkButton, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/categories";
import { listAccounts, listCategories, listTransactions } from "@/lib/data";
import { monthRange } from "@/lib/dates";
import { monthFromParam, stringParam } from "@/lib/month-param";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function TransactionsPage({ searchParams }: PageProps<"/lancamentos">) {
  const { supabase } = await getAppContext();
  const params = await searchParams;
  const month = monthFromParam(params.mes);
  const accountId = stringParam(params.conta);
  const categoryId = stringParam(params.categoria);
  const search = stringParam(params.q);
  const uncategorized = stringParam(params.sem_categoria) === "1";
  const { start, end } = monthRange(month);

  const [accounts, categories] = await Promise.all([
    listAccounts(supabase, { includeArchived: true }),
    listCategories(supabase),
  ]);
  const categoryIds = categoryId
    ? [categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)]
    : undefined;
  const transactions = await listTransactions(supabase, {
    start,
    end,
    accountId,
    categoryIds,
    uncategorized,
    search,
    limit: 1000,
  });

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount_cents, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s - t.amount_cents, 0);
  const options = buildCategoryOptions(categories);
  const filterParams = {
    conta: accountId,
    categoria: categoryId,
    q: search,
    sem_categoria: uncategorized ? "1" : undefined,
  };
  const hasFilters = !!(accountId || categoryId || search || uncategorized);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Lançamentos"
        action={
          <LinkButton href="/lancamentos/novo" className="px-3" aria-label="Novo lançamento">
            <PlusIcon size={18} /> Novo
          </LinkButton>
        }
      />
      <div className="flex justify-center">
        <MonthSwitcher month={month} basePath="/lancamentos" params={filterParams} />
      </div>

      <form className="flex flex-col gap-2" role="search">
        <input type="hidden" name="mes" value={month} />
        <div className="relative">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar descrição ou observação"
            aria-label="Buscar"
            className={inputClass("pl-9")}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="conta" defaultValue={accountId ?? ""} aria-label="Conta" className={inputClass("text-sm")}>
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="categoria" defaultValue={categoryId ?? ""} aria-label="Categoria" className={inputClass("text-sm")}>
            <option value="">Todas as categorias</option>
            {options
              .filter((o) => o.parentId === null)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="sem_categoria" value="1" defaultChecked={uncategorized} className="h-4 w-4" />
            Só sem categoria
          </label>
          <div className="flex gap-2">
            {hasFilters && (
              <Link href={`/lancamentos?mes=${month}`} className="px-2 py-2 text-sm font-medium text-ink-2">
                Limpar
              </Link>
            )}
            <button type="submit" className="rounded-xl px-3 py-2 text-sm font-semibold text-accent-text hover:bg-surface-2">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Card className="px-3 py-2.5">
          <p className="text-xs text-ink-2">Entradas</p>
          <p className="tabular font-semibold text-good-text">+{formatCents(income)}</p>
        </Card>
        <Card className="px-3 py-2.5">
          <p className="text-xs text-ink-2">Saídas</p>
          <p className="tabular font-semibold">−{formatCents(expense)}</p>
        </Card>
      </div>

      {transactions.length > 0 ? (
        <TransactionList
          transactions={transactions}
          ctx={{
            categories: new Map(categories.map((c) => [c.id, c])),
            accounts: new Map(accounts.map((a) => [a.id, { name: a.name, type: a.type }])),
          }}
        />
      ) : (
        <Card>
          <EmptyState title={hasFilters ? "Nada encontrado com esses filtros" : "Nenhum lançamento neste mês"} />
        </Card>
      )}
    </div>
  );
}
