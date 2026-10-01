import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileIcon, TrashIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { TransactionForm } from "@/components/transaction-form";
import { Card, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/categories";
import { getTransaction, listAccounts, listCategories, listMembers } from "@/lib/data";
import { formatDateBR, monthKeyOf } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { suggestRulePattern } from "@/lib/text";
import { kindOf } from "@/lib/transaction-builder";
import { deleteTransaction, saveTransaction } from "../actions";

export const metadata: Metadata = { title: "Editar lançamento" };

const SOURCE_LABEL = {
  manual: "Lançado à mão",
  receipt: "Lido de comprovante",
  open_finance: "Importado do banco (Open Finance)",
  ofx: "Importado de arquivo OFX",
} as const;

export default async function EditTransactionPage({ params }: PageProps<"/lancamentos/[id]">) {
  const { id } = await params;
  const { supabase } = await getAppContext();
  const tx = await getTransaction(supabase, id);
  if (!tx) notFound();

  const [accounts, categories, members] = await Promise.all([
    listAccounts(supabase, { includeArchived: true }),
    listCategories(supabase),
    listMembers(supabase),
  ]);
  const imported = tx.source === "open_finance" || tx.source === "ofx";
  const creator = members.find((m) => m.id === tx.created_by);
  const returnTo = `/lancamentos?mes=${monthKeyOf(tx.date)}`;
  const kind = kindOf(tx);
  const allowedKinds: ("expense" | "income" | "refund" | "transfer")[] | undefined = imported
    ? tx.amount_cents < 0
      ? ["expense", "transfer"]
      : ["income", "refund", "transfer"]
    : tx.transfer_group_id
      ? ["transfer"]
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Lançamento" back={returnTo} />
      <Card className="p-4">
        <TransactionForm
          action={saveTransaction}
          mode="edit"
          lockedValues={imported}
          allowedKinds={allowedKinds}
          accounts={accounts}
          categories={buildCategoryOptions(categories)}
          suggestedPattern={suggestRulePattern(tx.original_description ?? tx.description)}
          returnTo={returnTo}
          defaults={{
            id: tx.id,
            kind,
            accountId: tx.account_id,
            amount: centsToInput(Math.abs(tx.amount_cents)),
            date: tx.date,
            description: tx.description,
            categoryId: tx.category_id ?? "",
            notes: tx.notes ?? "",
            installments: 1,
            invoiceMonth: tx.invoice_month ? monthKeyOf(tx.invoice_month) : "",
          }}
        />
      </Card>

      <Card className="flex flex-col gap-2 p-4 text-sm text-ink-2">
        <p>
          {SOURCE_LABEL[tx.source]}
          {creator ? ` por ${creator.display_name}` : ""} · criado em{" "}
          {formatDateBR(tx.created_at.slice(0, 10))}
        </p>
        {tx.original_description && tx.original_description !== tx.description && (
          <p>
            Descrição no banco: <span className="text-ink">{tx.original_description}</span>
          </p>
        )}
        {tx.installment_number && (
          <p>
            Parcela {tx.installment_number} de {tx.installment_total}. Descrição e categoria valem para todas as
            parcelas.
          </p>
        )}
        {tx.transfer_group_id && <p>Transferência entre contas: as duas pontas são atualizadas juntas.</p>}
        {tx.receipt_id && (
          <Link href={`/comprovantes/${tx.receipt_id}`} className="inline-flex items-center gap-1.5 font-medium text-accent-text">
            <FileIcon size={16} /> Ver comprovante
          </Link>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <form action={deleteTransaction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={tx.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          {tx.installment_group_id && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="scope" value="all" className="h-4 w-4" />
              Excluir todas as parcelas desta compra
            </label>
          )}
          {imported && (
            <p className="text-xs text-muted">
              Se excluir um lançamento do banco, ele pode voltar na próxima sincronização.
            </p>
          )}
          <SubmitButton variant="danger" pendingText="Excluindo…">
            <TrashIcon size={18} /> Excluir lançamento
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
