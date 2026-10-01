import { describe, expect, it } from "vitest";
import type { ImportedTransactionDraft } from "./import-drafts";
import { planImport, type ExistingTransaction } from "./import-plan";

function draft(overrides: Partial<ImportedTransactionDraft>): ImportedTransactionDraft {
  return {
    externalId: "p1",
    amountCents: -4590,
    date: "2026-09-10",
    description: "Uber Trip",
    originalDescription: "UBER *TRIP",
    status: "cleared",
    type: "expense",
    invoiceMonth: null,
    installmentNumber: null,
    installmentTotal: null,
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingTransaction>): ExistingTransaction {
  return {
    id: "e1",
    accountId: "acc",
    amountCents: -4590,
    date: "2026-09-10",
    source: "open_finance",
    status: "cleared",
    externalId: "p1",
    invoiceMonth: null,
    originalDescription: "UBER *TRIP",
    ...overrides,
  };
}

const base = {
  accountId: "acc",
  source: "open_finance" as const,
  rules: [
    { pattern: "uber", categoryId: "transporte" },
    { pattern: "salario", categoryId: "salario" },
  ],
  categoryKinds: new Map<string, "income" | "expense">([
    ["transporte", "expense"],
    ["salario", "income"],
  ]),
  pendingWindowStart: "2026-09-01",
};

describe("planImport", () => {
  it("insere novo com categoria da regra", () => {
    const plan = planImport({ ...base, drafts: [draft({})], existing: [] });
    expect(plan.inserts).toEqual([{ draft: draft({}), categoryId: "transporte" }]);
    expect(plan.updates).toEqual([]);
  });

  it("regra de despesa não categoriza receita", () => {
    const plan = planImport({
      ...base,
      drafts: [draft({ type: "income", amountCents: 100, description: "Uber reembolso", originalDescription: "UBER REEMB" })],
      existing: [],
    });
    expect(plan.inserts[0].categoryId).toBeNull();
  });

  it("transferência fica sem categoria", () => {
    const plan = planImport({ ...base, drafts: [draft({ type: "transfer" })], existing: [] });
    expect(plan.inserts[0].categoryId).toBeNull();
  });

  it("já importado: atualiza só o que mudou", () => {
    expect(planImport({ ...base, drafts: [draft({})], existing: [existing({})] })).toEqual({
      inserts: [],
      updates: [],
      deleteIds: [],
    });
    const plan = planImport({
      ...base,
      drafts: [draft({ status: "cleared", date: "2026-09-11" })],
      existing: [existing({ status: "pending" })],
    });
    expect(plan.updates).toEqual([{ id: "e1", changes: { date: "2026-09-11", status: "cleared" }, linked: false }]);
  });

  it("vincula comprovante lançado antes", () => {
    const plan = planImport({
      ...base,
      drafts: [draft({ date: "2026-09-11" })],
      existing: [existing({ id: "r1", source: "receipt", externalId: null })],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        id: "r1",
        changes: { external_id: "p1", date: "2026-09-11", status: "cleared", original_description: "UBER *TRIP" },
        linked: true,
      },
    ]);
  });

  it("pendente que ganhou novo id é substituído, não duplicado", () => {
    const plan = planImport({
      ...base,
      drafts: [draft({ externalId: "p2" })],
      existing: [existing({ id: "pend", externalId: "p0", status: "pending" })],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.updates[0]).toMatchObject({ id: "pend", changes: { external_id: "p2" }, linked: false });
    expect(plan.deleteIds).toEqual([]);
  });

  it("remove pendente que sumiu do banco", () => {
    const plan = planImport({
      ...base,
      drafts: [draft({ externalId: "outro", amountCents: -1 })],
      existing: [existing({ id: "pend", externalId: "p0", status: "pending", date: "2026-09-05" })],
    });
    expect(plan.deleteIds).toEqual(["pend"]);
  });

  it("não remove pendente fora da janela nem no OFX", () => {
    const old = existing({ id: "pend", externalId: "p0", status: "pending", date: "2026-08-01" });
    expect(planImport({ ...base, drafts: [], existing: [old] }).deleteIds).toEqual([]);
    expect(
      planImport({ ...base, source: "ofx", drafts: [], existing: [{ ...old, date: "2026-09-05" }] }).deleteIds,
    ).toEqual([]);
  });

  it("duas compras iguais no mesmo dia viram dois lançamentos", () => {
    const plan = planImport({
      ...base,
      drafts: [draft({ externalId: "a" }), draft({ externalId: "b" })],
      existing: [existing({ id: "m1", source: "manual", externalId: null })],
    });
    expect(plan.updates.map((u) => u.id)).toEqual(["m1"]);
    expect(plan.inserts.map((i) => i.draft.externalId)).toEqual(["b"]);
  });

  it("ignora id externo repetido no lote", () => {
    const plan = planImport({ ...base, drafts: [draft({}), draft({})], existing: [] });
    expect(plan.inserts).toHaveLength(1);
  });
});
