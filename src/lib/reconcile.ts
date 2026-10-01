import { diffDays, type ISODate } from "./dates";

export type ReconcileCandidate = {
  id: string;
  accountId: string;
  amountCents: number;
  date: ISODate;
  source: "manual" | "receipt" | "open_finance" | "ofx";
  status: "pending" | "cleared";
  externalId: string | null;
};

export type IncomingTransaction = {
  accountId: string;
  amountCents: number;
  date: ISODate;
  externalId: string;
  source: "open_finance" | "ofx";
};

export const RECONCILE_TOLERANCE_DAYS = 3;

/**
 * Procura um lançamento já existente que represente o mesmo gasto vindo do banco:
 * - lançado à mão ou por comprovante (ainda sem vínculo com o banco), ou
 * - um lançamento pendente da mesma origem que ganhou outro id ao ser compensado.
 * Exige mesma conta e mesmo valor; a data pode variar até 3 dias. Escolhe o mais próximo.
 */
export function findReconcileMatch(
  incoming: IncomingTransaction,
  candidates: ReconcileCandidate[],
  options: {
    /** Candidatos já usados por outro lançamento do mesmo lote. */
    excludeIds?: ReadonlySet<string>;
    /** Ids externos presentes no lote atual: um pendente que ainda aparece não foi substituído. */
    activeExternalIds?: ReadonlySet<string>;
  } = {},
): ReconcileCandidate | null {
  const excludeIds = options.excludeIds ?? new Set<string>();
  const activeExternalIds = options.activeExternalIds ?? new Set<string>();
  let best: ReconcileCandidate | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (excludeIds.has(candidate.id)) continue;
    if (candidate.accountId !== incoming.accountId) continue;
    if (candidate.amountCents !== incoming.amountCents) continue;

    const unlinkedLocal =
      (candidate.source === "manual" || candidate.source === "receipt") && candidate.externalId === null;
    const supersededPending =
      candidate.source === incoming.source &&
      candidate.status === "pending" &&
      candidate.externalId !== null &&
      candidate.externalId !== incoming.externalId &&
      !activeExternalIds.has(candidate.externalId);
    if (!unlinkedLocal && !supersededPending) continue;

    const distance = Math.abs(diffDays(candidate.date, incoming.date));
    if (distance > RECONCILE_TOLERANCE_DAYS) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
