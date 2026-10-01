import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrashIcon } from "@/components/icons";
import { ProcessReceiptButton } from "@/components/process-receipt-button";
import { SubmitButton } from "@/components/submit-button";
import { TransactionForm, type TransactionFormDefaults } from "@/components/transaction-form";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/categories";
import { listAccounts, listCategories } from "@/lib/data";
import { formatDateBR, todayISO } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";
import { centsToInput, formatCents } from "@/lib/money";
import { extractionToDraft, receiptExtractionSchema } from "@/lib/receipt";
import { suggestRulePattern } from "@/lib/text";
import { saveTransaction } from "../../lancamentos/actions";
import { deleteReceipt } from "../actions";

export const metadata: Metadata = { title: "Comprovante" };
export const maxDuration = 60;

export default async function ReceiptPage({ params }: PageProps<"/comprovantes/[id]">) {
  const { id } = await params;
  const { supabase } = await getAppContext();
  const { data: receipt } = await supabase.from("receipts").select("*").eq("id", id).maybeSingle();
  if (!receipt) notFound();

  const [accounts, categories, signed, linked] = await Promise.all([
    listAccounts(supabase),
    listCategories(supabase),
    supabase.storage.from("receipts").createSignedUrl(receipt.storage_path, 600),
    supabase
      .from("transactions")
      .select("id, description, amount_cents, date")
      .eq("receipt_id", id)
      .order("date"),
  ]);
  const fileUrl = signed.data?.signedUrl ?? null;
  const isPdf = receipt.mime_type === "application/pdf";
  const categoryOptions = buildCategoryOptions(categories);
  const today = todayISO();

  const parsed = receipt.extraction ? receiptExtractionSchema.safeParse(receipt.extraction) : null;
  const draft = parsed?.success
    ? extractionToDraft(parsed.data, {
        accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, institution: a.institution })),
        categories: categoryOptions,
        today,
      })
    : null;

  const defaults: TransactionFormDefaults = {
    kind: draft?.type ?? "expense",
    accountId: draft?.accountId ?? accounts[0]?.id ?? "",
    amount: draft?.amountCents ? centsToInput(draft.amountCents) : "",
    date: draft?.date ?? today,
    description: draft?.description ?? "",
    categoryId: draft?.categoryId ?? "",
    notes: draft?.notes ?? "",
    installments: draft?.installments ?? 1,
    invoiceMonth: "",
    receiptId: receipt.id,
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Comprovante" back="/comprovantes" />

      {fileUrl && (
        <Card className="overflow-hidden">
          {isPdf ? (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="block px-4 py-3 text-sm font-medium text-accent-text">
              Abrir PDF ({receipt.file_name ?? "comprovante"})
            </a>
          ) : (
            <a href={fileUrl} target="_blank" rel="noreferrer" aria-label="Abrir imagem em tamanho real">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl} alt="Comprovante enviado" className="max-h-80 w-full bg-surface-2 object-contain" />
            </a>
          )}
        </Card>
      )}

      {receipt.status === "confirmed" ? (
        <Card className="flex flex-col gap-2 p-4">
          <Notice tone="success">Este comprovante já foi lançado.</Notice>
          <ul className="flex flex-col gap-1 text-sm">
            {(linked.data ?? []).map((tx) => (
              <li key={tx.id}>
                <Link href={`/lancamentos/${tx.id}`} className="font-medium text-accent-text hover:underline">
                  {tx.description} · {formatCents(Math.abs(tx.amount_cents))} · {formatDateBR(tx.date)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <>
          {receipt.status === "uploaded" && isAiConfigured() && (
            <Card className="p-4">
              <ProcessReceiptButton id={receipt.id} />
            </Card>
          )}
          {receipt.status === "failed" && (
            <Card className="flex flex-col gap-3 p-4">
              <Notice tone="error">A leitura automática falhou: {receipt.error ?? "erro desconhecido"}.</Notice>
              {isAiConfigured() && <ProcessReceiptButton id={receipt.id} label="Tentar ler de novo" />}
            </Card>
          )}
          {accounts.length === 0 ? (
            <Notice tone="warning">
              Cadastre uma conta ou cartão antes de lançar.{" "}
              <Link href="/contas/nova" className="font-medium text-accent-text">
                Cadastrar
              </Link>
            </Notice>
          ) : (
            <Card className="p-4">
              <h2 className="mb-3 text-base font-semibold">{draft ? "Confira e confirme" : "Preencha o lançamento"}</h2>
              <TransactionForm
                action={saveTransaction}
                mode="create"
                accounts={accounts}
                categories={categoryOptions}
                defaults={defaults}
                warnings={draft?.warnings ?? []}
                suggestedPattern={suggestRulePattern(defaults.description)}
                submitLabel="Confirmar lançamento"
              />
            </Card>
          )}
        </>
      )}

      <form action={deleteReceipt}>
        <input type="hidden" name="id" value={receipt.id} />
        <SubmitButton variant="ghost" pendingText="Excluindo…" className="w-full text-critical-text">
          <TrashIcon size={18} /> Excluir comprovante
        </SubmitButton>
      </form>
    </div>
  );
}
