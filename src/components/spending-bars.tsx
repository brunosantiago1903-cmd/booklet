import Link from "next/link";
import { formatCents } from "@/lib/money";
import { AlertIcon } from "./icons";

export type SpendingRow = {
  categoryId: string | null;
  name: string;
  cents: number;
  budgetCents: number | null;
};

const MAX_ROWS = 8;

/**
 * Barras horizontais de gasto por categoria. Uma série só: todas as barras em azul.
 * O orçamento aparece como marcador vertical; estouro/atenção vêm com ícone + texto.
 */
export function SpendingBars({ rows, hrefFor }: { rows: SpendingRow[]; hrefFor: (categoryId: string | null) => string }) {
  let visible = rows;
  if (rows.length > MAX_ROWS) {
    const head = rows.slice(0, MAX_ROWS - 1);
    const tail = rows.slice(MAX_ROWS - 1);
    visible = [
      ...head,
      {
        categoryId: "__outras__",
        name: `Outras (${tail.length})`,
        cents: tail.reduce((sum, r) => sum + r.cents, 0),
        budgetCents: null,
      },
    ];
  }
  const max = Math.max(1, ...visible.map((r) => Math.max(r.cents, r.budgetCents ?? 0)));

  return (
    <ul className="flex flex-col gap-3.5">
      {visible.map((row) => {
        const pct = (row.cents / max) * 100;
        const budgetPct = row.budgetCents ? (row.budgetCents / max) * 100 : null;
        const ratio = row.budgetCents ? row.cents / row.budgetCents : null;
        const state = ratio === null ? null : ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
        const summary = `${row.name}: ${formatCents(row.cents)}${
          row.budgetCents ? ` de ${formatCents(row.budgetCents)} orçados (${Math.round((ratio ?? 0) * 100)}%)` : ""
        }`;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{row.name}</span>
              <span className="tabular shrink-0 font-semibold">{formatCents(row.cents)}</span>
            </div>
            <div className="relative mt-1.5 h-4" aria-hidden="true">
              <div className="absolute inset-x-0 top-[7px] h-px bg-grid" />
              <div
                className="absolute left-0 top-[3px] h-2.5 rounded-r-[4px] bg-accent"
                style={{ width: `max(${pct.toFixed(2)}%, 3px)` }}
              />
              {budgetPct !== null && (
                <div
                  className="absolute top-0 h-4 w-0.5 rounded-full bg-ink-2"
                  style={{ left: `calc(${budgetPct.toFixed(2)}% - 1px)` }}
                />
              )}
            </div>
            {row.budgetCents !== null && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-2">
                {state === "over" && <AlertIcon size={14} className="text-critical-text" />}
                {state === "warning" && <AlertIcon size={14} className="text-warning-text" />}
                <span>
                  {state === "over"
                    ? `Passou ${formatCents(row.cents - row.budgetCents)} do orçamento de ${formatCents(row.budgetCents)}`
                    : `${Math.round((ratio ?? 0) * 100)}% de ${formatCents(row.budgetCents)} orçados`}
                </span>
              </p>
            )}
          </>
        );
        return (
          <li key={row.categoryId ?? "sem-categoria"} title={summary} aria-label={summary}>
            {row.categoryId === "__outras__" ? (
              <div>{content}</div>
            ) : (
              <Link href={hrefFor(row.categoryId)} className="-mx-2 block rounded-xl px-2 py-1 hover:bg-surface-2">
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
