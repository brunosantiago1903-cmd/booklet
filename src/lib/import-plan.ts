import type { ISODate } from "./dates";
import type { ImportedTransactionDraft } from "./import-drafts";
import { findReconcileMatch, type ReconcileCandidate } from "./reconcile";
import { matchRule, type CategoryRule } from "./rules";

export type ExistingTransaction = ReconcileCandidate & {
  invoiceMonth: ISODate | null;
  originalDescription: string | null;
};

export type PlannedInsert = {
  draft: ImportedTransactionDraft;
  categoryId: string | null;
};

export type PlannedUpdate = {
  id: string;
  changes: {
    external_id?: string;
    amount_cents?: number;
    date?: ISODate;
    status?: "pending" | "cleared";
    invoice_month?: ISODate | null;
    original_description?: string;
  };
  /** true quando vinculou um lançamento manual/comprovante ao banco. */
  linked: boolean;
};

export type ImportPlan = {
  inserts: PlannedInsert[];
  updates: PlannedUpdate[];
  /** Pendentes do Open Finance que sumiram do banco (cancelados ou substituídos). */
  deleteIds: string[];
};

/**
 * Decide o destino de cada lançamento vindo do banco:
 * 1. já importado (mesmo id externo) → atualiza valor/data/status/fatura se mudou;
 * 2. casa com lançamento manual/comprovante ou pendente substituído → vincula;
 * 3. senão → insere, com categoria da regra quando houver (e do tipo certo).
 * Descrição, categoria e tipo escolhidos pelo casal nunca são sobrescritos.
 */
export function planImport(params: {
  accountId: string;
  source: "open_finance" | "ofx";
  drafts: ImportedTransactionDraft[];
  existing: ExistingTransaction[];
  rules: CategoryRule[];
  categoryKinds: ReadonlyMap<string, "income" | "expense">;
  /** Só para Open Finance: pendentes nesta janela que não vieram mais são removidos. */
  pendingWindowStart: ISODate | null;
}): ImportPlan {
  const byExternal = new Map(
    params.existing.filter((e) => e.externalId !== null).map((e) => [e.externalId as string, e]),
  );
  const activeExternalIds = new Set(params.drafts.map((d) => d.externalId));
  const used = new Set<string>();
  const plan: ImportPlan = { inserts: [], updates: [], deleteIds: [] };
  const seenDrafts = new Set<string>();

  for (const draft of params.drafts) {
    if (seenDrafts.has(draft.externalId)) continue;
    seenDrafts.add(draft.externalId);

    const current = byExternal.get(draft.externalId);
    if (current) {
      used.add(current.id);
      const changes: PlannedUpdate["changes"] = {};
      if (current.amountCents !== draft.amountCents) changes.amount_cents = draft.amountCents;
      if (current.date !== draft.date) changes.date = draft.date;
      if (current.status !== draft.status) changes.status = draft.status;
      if (draft.invoiceMonth && current.invoiceMonth !== draft.invoiceMonth) changes.invoice_month = draft.invoiceMonth;
      if (current.originalDescription !== draft.originalDescription) {
        changes.original_description = draft.originalDescription;
      }
      if (Object.keys(changes).length > 0) plan.updates.push({ id: current.id, changes, linked: false });
      continue;
    }

    const match = findReconcileMatch(
      {
        accountId: params.accountId,
        amountCents: draft.amountCents,
        date: draft.date,
        externalId: draft.externalId,
        source: params.source,
      },
      params.existing,
      { excludeIds: used, activeExternalIds },
    );
    if (match) {
      used.add(match.id);
      plan.updates.push({
        id: match.id,
        changes: {
          external_id: draft.externalId,
          date: draft.date,
          status: draft.status,
          original_description: draft.originalDescription,
          ...(draft.invoiceMonth ? { invoice_month: draft.invoiceMonth } : {}),
        },
        linked: match.source === "manual" || match.source === "receipt",
      });
      continue;
    }

    let categoryId: string | null = null;
    if (draft.type !== "transfer") {
      const ruleCategory = matchRule(draft.originalDescription || draft.description, params.rules)
        ?? matchRule(draft.description, params.rules);
      const wantedKind = draft.type === "income" ? "income" : "expense";
      if (ruleCategory && params.categoryKinds.get(ruleCategory) === wantedKind) categoryId = ruleCategory;
    }
    plan.inserts.push({ draft, categoryId });
  }

  if (params.source === "open_finance" && params.pendingWindowStart) {
    for (const existing of params.existing) {
      if (
        existing.source === "open_finance" &&
        existing.status === "pending" &&
        existing.externalId !== null &&
        existing.date >= params.pendingWindowStart &&
        !activeExternalIds.has(existing.externalId) &&
        !used.has(existing.id)
      ) {
        plan.deleteIds.push(existing.id);
      }
    }
  }

  return plan;
}
