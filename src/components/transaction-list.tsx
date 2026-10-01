import Link from "next/link";
import { categoryLabel, type CategoryRow } from "@/lib/categories";
import type { Transaction } from "@/lib/data";
import { weekdayDateBR } from "@/lib/dates";
import { BankIcon, FileIcon, SparklesIcon } from "./icons";
import { Amount, Badge } from "./ui";

export type ListContext = {
  categories: ReadonlyMap<string, CategoryRow>;
  accounts: ReadonlyMap<string, { name: string; type: "checking" | "credit_card" }>;
};

export function TransactionRow({ tx, ctx }: { tx: Transaction; ctx: ListContext }) {
  const category = categoryLabel(tx.category_id, ctx.categories);
  const account = ctx.accounts.get(tx.account_id);
  const kind = tx.type === "transfer" ? "transfer" : tx.amount_cents > 0 ? "income" : "expense";

  return (
    <Link
      href={`/lancamentos/${tx.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{tx.description}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          {tx.type === "transfer" ? (
            <span>Transferência</span>
          ) : category ? (
            <span className="inline-flex items-center gap-1">
              {category}
              {tx.category_source === "ai" && (
                <SparklesIcon size={13} aria-label="sugerida pela IA" className="text-accent-text" />
              )}
            </span>
          ) : (
            <Badge tone="warning">Sem categoria</Badge>
          )}
          {account && <span className="text-muted">· {account.name}</span>}
          {tx.installment_number && (
            <span className="text-muted">
              · {tx.installment_number}/{tx.installment_total}
            </span>
          )}
          {tx.status === "pending" && <Badge>Pendente</Badge>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Amount cents={tx.amount_cents} kind={kind} />
        <span className="flex gap-1 text-muted">
          {tx.receipt_id && <FileIcon size={14} aria-label="com comprovante" />}
          {(tx.source === "open_finance" || tx.source === "ofx" || tx.external_id) && (
            <BankIcon size={14} aria-label="conferido com o banco" />
          )}
        </span>
      </div>
    </Link>
  );
}

/** Lista agrupada por dia. */
export function TransactionList({ transactions, ctx }: { transactions: Transaction[]; ctx: ListContext }) {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const tx of transactions) {
    const last = groups.at(-1);
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.date} aria-label={weekdayDateBR(group.date)}>
          <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {weekdayDateBR(group.date)}
          </h3>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {group.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} ctx={ctx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
