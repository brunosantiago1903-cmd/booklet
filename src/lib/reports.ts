import type { CategoryRow } from "./categories";

export type ReportTransaction = {
  type: "income" | "expense" | "transfer";
  amountCents: number;
  categoryId: string | null;
};

export type CategorySpending = {
  categoryId: string | null;
  name: string;
  cents: number;
};

export type MonthSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  spendingByCategory: CategorySpending[];
};

/**
 * Totais do mês. Transferências (incluindo pagamento de fatura) ficam de fora.
 * Despesa com valor positivo (estorno) abate o gasto da categoria.
 */
export function summarizeMonth(
  transactions: ReportTransaction[],
  categories: ReadonlyMap<string, CategoryRow>,
): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  const byCategory = new Map<string | null, number>();

  for (const tx of transactions) {
    if (tx.type === "income") {
      incomeCents += tx.amountCents;
    } else if (tx.type === "expense") {
      const spent = -tx.amountCents;
      expenseCents += spent;
      const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
      const topLevel = category ? (category.parent_id ?? category.id) : null;
      byCategory.set(topLevel, (byCategory.get(topLevel) ?? 0) + spent);
    }
  }

  const spendingByCategory = [...byCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      name: categoryId ? (categories.get(categoryId)?.name ?? "Categoria removida") : "Sem categoria",
      cents,
    }))
    .filter((row) => row.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, spendingByCategory };
}

export type BudgetStatus = {
  categoryId: string;
  name: string;
  budgetCents: number;
  spentCents: number;
  /** 0..n (1 = 100% do orçamento). */
  ratio: number;
  state: "ok" | "warning" | "over";
};

export function budgetStatuses(
  budgets: { categoryId: string; amountCents: number }[],
  spending: CategorySpending[],
  categories: ReadonlyMap<string, CategoryRow>,
): BudgetStatus[] {
  const spentByCategory = new Map(spending.map((s) => [s.categoryId, s.cents]));
  return budgets
    .map((budget) => {
      const spentCents = spentByCategory.get(budget.categoryId) ?? 0;
      const ratio = spentCents / budget.amountCents;
      const state: BudgetStatus["state"] = ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
      return {
        categoryId: budget.categoryId,
        name: categories.get(budget.categoryId)?.name ?? "Categoria removida",
        budgetCents: budget.amountCents,
        spentCents,
        ratio,
        state,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
