export type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  kind: "income" | "expense";
  archived: boolean;
};

export type CategoryOption = {
  id: string;
  label: string;
  kind: "income" | "expense";
  parentId: string | null;
  topLevelId: string;
};

const collator = new Intl.Collator("pt-BR");

/** Lista "Categoria" e "Categoria › Subcategoria" em ordem alfabética, agrupada pela principal. */
export function buildCategoryOptions(categories: CategoryRow[], { includeArchived = false } = {}): CategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const visible = categories.filter((c) => includeArchived || !c.archived);
  const parents = visible.filter((c) => c.parent_id === null).sort((a, b) => collator.compare(a.name, b.name));
  const options: CategoryOption[] = [];

  for (const parent of parents) {
    options.push({ id: parent.id, label: parent.name, kind: parent.kind, parentId: null, topLevelId: parent.id });
    const children = visible
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => collator.compare(a.name, b.name));
    for (const child of children) {
      options.push({
        id: child.id,
        label: `${parent.name} › ${child.name}`,
        kind: child.kind,
        parentId: parent.id,
        topLevelId: parent.id,
      });
    }
  }

  // Subcategorias cuja principal foi arquivada continuam acessíveis.
  for (const orphan of visible) {
    if (orphan.parent_id && !options.some((o) => o.id === orphan.id)) {
      const parent = byId.get(orphan.parent_id);
      options.push({
        id: orphan.id,
        label: parent ? `${parent.name} › ${orphan.name}` : orphan.name,
        kind: orphan.kind,
        parentId: orphan.parent_id,
        topLevelId: orphan.parent_id,
      });
    }
  }
  return options;
}

export function topLevelCategoryId(categoryId: string, categories: ReadonlyMap<string, CategoryRow>): string {
  const category = categories.get(categoryId);
  return category?.parent_id ?? categoryId;
}

export function categoryLabel(categoryId: string | null, categories: ReadonlyMap<string, CategoryRow>): string | null {
  if (!categoryId) return null;
  const category = categories.get(categoryId);
  if (!category) return null;
  const parent = category.parent_id ? categories.get(category.parent_id) : null;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
