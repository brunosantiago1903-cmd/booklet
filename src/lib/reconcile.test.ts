import { describe, expect, it } from "vitest";
import { findReconcileMatch, type ReconcileCandidate } from "./reconcile";

const base: ReconcileCandidate = {
  id: "manual-1",
  accountId: "acc",
  amountCents: -4590,
  date: "2026-09-10",
  source: "receipt",
  status: "cleared",
  externalId: null,
};

const incoming = {
  accountId: "acc",
  amountCents: -4590,
  date: "2026-09-11",
  externalId: "pluggy-1",
  source: "open_finance" as const,
};

describe("findReconcileMatch", () => {
  it("casa o comprovante com o lançamento do banco", () => {
    expect(findReconcileMatch(incoming, [base])?.id).toBe("manual-1");
  });

  it("exige mesma conta e mesmo valor", () => {
    expect(findReconcileMatch(incoming, [{ ...base, accountId: "outra" }])).toBeNull();
    expect(findReconcileMatch(incoming, [{ ...base, amountCents: -4591 }])).toBeNull();
  });

  it("tolera até 3 dias e escolhe o mais próximo", () => {
    expect(findReconcileMatch(incoming, [{ ...base, date: "2026-09-15" }])).toBeNull();
    const match = findReconcileMatch(incoming, [
      { ...base, id: "longe", date: "2026-09-08" },
      { ...base, id: "perto", date: "2026-09-11" },
    ]);
    expect(match?.id).toBe("perto");
  });

  it("não reaproveita lançamento já vinculado a outro id do banco", () => {
    expect(
      findReconcileMatch(incoming, [{ ...base, source: "open_finance", status: "cleared", externalId: "pluggy-0" }]),
    ).toBeNull();
  });

  it("substitui pendente que ganhou novo id ao ser compensado", () => {
    const pending = { ...base, id: "pend", source: "open_finance" as const, status: "pending" as const, externalId: "pluggy-0" };
    expect(findReconcileMatch(incoming, [pending])?.id).toBe("pend");
    // Se o pendente ainda aparece no lote, são duas compras diferentes.
    expect(findReconcileMatch(incoming, [pending], { activeExternalIds: new Set(["pluggy-0"]) })).toBeNull();
  });

  it("não casa duas vezes o mesmo candidato no lote", () => {
    expect(findReconcileMatch(incoming, [base], { excludeIds: new Set(["manual-1"]) })).toBeNull();
  });

  it("OFX não substitui pendentes do Open Finance", () => {
    const pending = { ...base, source: "open_finance" as const, status: "pending" as const, externalId: "p" };
    expect(findReconcileMatch({ ...incoming, source: "ofx" }, [pending])).toBeNull();
  });
});
