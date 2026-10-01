import Link from "next/link";
import type { CardSummary } from "@/lib/cards";
import { formatDateBR, formatMonthBR, monthKeyOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { AlertIcon, CheckIcon } from "./icons";
import { Badge, Meter } from "./ui";

export function payBillHref(cardId: string, summary: CardSummary) {
  const params = new URLSearchParams({
    tipo: "transfer",
    para: cardId,
    valor: String(summary.closedRemainingCents),
    fatura: monthKeyOf(summary.closedInvoiceMonth),
  });
  return `/lancamentos/novo?${params.toString()}`;
}

export function CardSummaryView({
  card,
  summary,
}: {
  card: { id: string; name: string };
  summary: CardSummary;
}) {
  const limitRatio = summary.limitCents ? summary.usedCents / summary.limitCents : null;
  const limitState = limitRatio === null ? "ok" : limitRatio > 1 ? "over" : limitRatio >= 0.8 ? "warning" : "ok";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/contas/${card.id}`} className="font-semibold hover:underline">
            {card.name}
          </Link>
          <p className="text-xs text-ink-2">
            Fatura de {formatMonthBR(monthKeyOf(summary.openInvoiceMonth))} · vence {formatDateBR(summary.openDueDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-semibold">{formatCents(summary.openCents)}</p>
          <p className="text-xs text-ink-2">em aberto</p>
        </div>
      </div>

      {summary.closedState === "due" || summary.closedState === "overdue" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <AlertIcon
              size={16}
              className={summary.closedState === "overdue" ? "text-critical-text" : "text-warning-text"}
            />
            <span>
              {summary.closedState === "overdue" ? "Venceu" : "Vence"} {formatDateBR(summary.closedDueDate)}:{" "}
              <strong className="tabular">{formatCents(summary.closedRemainingCents)}</strong>
            </span>
          </span>
          <Link href={payBillHref(card.id, summary)} className="shrink-0 font-semibold text-accent-text">
            Registrar pagamento
          </Link>
        </div>
      ) : summary.closedState === "paid" ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <CheckIcon size={14} className="text-good-text" /> Fatura de{" "}
          {formatMonthBR(monthKeyOf(summary.closedInvoiceMonth))} paga
        </p>
      ) : null}

      {summary.limitCents ? (
        <div className="flex flex-col gap-1">
          <Meter ratio={limitRatio ?? 0} state={limitState} label={`Limite usado de ${card.name}`} />
          <div className="flex justify-between text-xs text-ink-2">
            <span className="tabular">
              {formatCents(summary.usedCents)} de {formatCents(summary.limitCents)}
            </span>
            {limitState !== "ok" ? (
              <Badge tone={limitState === "over" ? "critical" : "warning"}>
                <AlertIcon size={12} /> {limitState === "over" ? "Limite estourado" : "Limite quase no fim"}
              </Badge>
            ) : (
              <span className="tabular">{formatCents(Math.max(0, summary.limitCents - summary.usedCents))} livres</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
