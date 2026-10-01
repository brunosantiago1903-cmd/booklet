import type { Metadata } from "next";
import { TrashIcon } from "@/components/icons";
import { InlineForm } from "@/components/inline-form";
import { Card, CardHeader, inputClass, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { categoryLabel, type CategoryRow } from "@/lib/categories";
import { listBudgets, listCategories, listRules } from "@/lib/data";
import { centsToInput, formatCents } from "@/lib/money";
import {
  createCategory,
  deleteRule,
  renameCategory,
  saveBudget,
  toggleCategoryArchived,
} from "./actions";

export const metadata: Metadata = { title: "Categorias e orçamentos" };

const collator = new Intl.Collator("pt-BR");

export default async function CategoriesPage() {
  const { supabase } = await getAppContext();
  const [categories, budgets, rules] = await Promise.all([
    listCategories(supabase),
    listBudgets(supabase),
    listRules(supabase),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const budgetBy = new Map(budgets.map((b) => [b.category_id, b.amount_cents]));
  const parents = (kind: "income" | "expense") =>
    categories.filter((c) => c.parent_id === null && c.kind === kind).sort((a, b) => collator.compare(a.name, b.name));
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parent_id === id).sort((a, b) => collator.compare(a.name, b.name));
  const totalBudget = budgets.reduce((s, b) => s + b.amount_cents, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Categorias" back="/mais" />

      <Card className="p-4">
        <p className="text-sm text-ink-2">
          Defina um orçamento mensal nas categorias de despesa. O painel mostra o quanto já foi gasto de cada uma.
          {totalBudget > 0 && (
            <>
              {" "}
              Total orçado: <strong className="tabular text-ink">{formatCents(totalBudget)}</strong>.
            </>
          )}
        </p>
      </Card>

      <Section title="Despesas" categories={parents("expense")} childrenOf={childrenOf} budgetBy={budgetBy} withBudget />
      <Section title="Receitas" categories={parents("income")} childrenOf={childrenOf} budgetBy={budgetBy} />

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Nova categoria principal</h2>
        <InlineForm action={createCategory} submitLabel="Criar">
          <input name="name" required maxLength={60} placeholder="Nome" aria-label="Nome" className={inputClass("flex-1")} />
          <select name="kind" aria-label="Tipo" className={inputClass("w-32")} defaultValue="expense">
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </InlineForm>
      </Card>

      <Card>
        <CardHeader
          title="Regras automáticas"
          subtitle="Lançamentos importados cuja descrição contém o trecho recebem a categoria."
        />
        {rules.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-ink-2">
            Nenhuma regra ainda. Ao editar um lançamento, marque “Usar esta categoria sempre…”.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-mono">“{rule.pattern}”</span>
                  <span className="text-ink-2"> → {categoryLabel(rule.category_id, byId) ?? "—"}</span>
                </span>
                <form action={deleteRule}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button
                    type="submit"
                    aria-label={`Excluir regra ${rule.pattern}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
                  >
                    <TrashIcon size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Section({
  title,
  categories,
  childrenOf,
  budgetBy,
  withBudget = false,
}: {
  title: string;
  categories: CategoryRow[];
  childrenOf: (id: string) => CategoryRow[];
  budgetBy: Map<string, number>;
  withBudget?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="mt-2 divide-y divide-line">
        {categories.map((category) => {
          const children = childrenOf(category.id);
          const budget = budgetBy.get(category.id);
          return (
            <li key={category.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className={category.archived ? "text-muted line-through" : "font-medium"}>{category.name}</span>
                  <span className="text-sm text-ink-2">
                    {withBudget && budget ? `${formatCents(budget)}/mês` : `${children.length} sub`}
                  </span>
                </summary>
                <div className="flex flex-col gap-3 bg-surface-2/50 px-4 pb-4 pt-1">
                  {withBudget && !category.archived && (
                    <InlineForm action={saveBudget} submitLabel="Salvar">
                      <input type="hidden" name="category_id" value={category.id} />
                      <input
                        name="amount"
                        inputMode="decimal"
                        placeholder="Orçamento mensal (vazio = sem)"
                        aria-label={`Orçamento mensal de ${category.name}`}
                        defaultValue={budget ? centsToInput(budget) : ""}
                        className={inputClass("tabular flex-1")}
                      />
                    </InlineForm>
                  )}
                  <InlineForm action={renameCategory} submitLabel="Renomear">
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      name="name"
                      defaultValue={category.name}
                      aria-label="Nome"
                      required
                      className={inputClass("flex-1")}
                    />
                  </InlineForm>

                  {children.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {children.map((child) => (
                        <li key={child.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className={child.archived ? "text-muted line-through" : ""}>{child.name}</span>
                          <ArchiveToggle id={child.id} archived={child.archived} />
                        </li>
                      ))}
                    </ul>
                  )}

                  <InlineForm action={createCategory} submitLabel="Adicionar">
                    <input type="hidden" name="parent_id" value={category.id} />
                    <input type="hidden" name="kind" value={category.kind} />
                    <input
                      name="name"
                      required
                      maxLength={60}
                      placeholder="Nova subcategoria"
                      aria-label={`Nova subcategoria de ${category.name}`}
                      className={inputClass("flex-1")}
                    />
                  </InlineForm>
                  <div className="flex justify-end">
                    <ArchiveToggle id={category.id} archived={category.archived} label />
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ArchiveToggle({ id, archived, label = false }: { id: string; archived: boolean; label?: boolean }) {
  return (
    <form action={toggleCategoryArchived}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <button type="submit" className="rounded-lg px-2 py-1 text-xs font-medium text-accent-text hover:bg-surface">
        {archived ? "Reativar" : label ? "Arquivar categoria" : "Arquivar"}
      </button>
    </form>
  );
}
