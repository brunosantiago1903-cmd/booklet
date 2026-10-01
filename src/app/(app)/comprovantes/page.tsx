import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowsIcon, ChevronRightIcon, FileIcon, PlusIcon } from "@/components/icons";
import { ReceiptUploader } from "@/components/receipt-uploader";
import { Badge, Card, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listMembers, listReceipts } from "@/lib/data";
import { formatDateBR } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Adicionar" };
// A leitura do comprovante (Server Action) roda nesta rota.
export const maxDuration = 60;

const STATUS = {
  uploaded: { label: "Aguardando leitura", tone: "neutral" },
  extracted: { label: "Confirmar", tone: "accent" },
  failed: { label: "Falhou: preencher", tone: "warning" },
  confirmed: { label: "Lançado", tone: "good" },
} as const;

export default async function ReceiptsPage() {
  const { supabase, householdId } = await getAppContext();
  const [receipts, members] = await Promise.all([listReceipts(supabase), listMembers(supabase)]);
  const memberName = new Map(members.map((m) => [m.id, m.display_name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Adicionar" />

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-base font-semibold">Enviar comprovante</h2>
          <p className="text-sm text-ink-2">
            Foto, print ou PDF de Pix, boleto, cupom ou nota. A IA preenche o lançamento e você só confere.
          </p>
        </div>
        {!isAiConfigured() && (
          <Notice tone="warning">
            Leitura automática desligada: falta configurar <code>ANTHROPIC_API_KEY</code>. O arquivo fica guardado e você
            preenche os dados manualmente.
          </Notice>
        )}
        <Suspense>
          <ReceiptUploader householdId={householdId} />
        </Suspense>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton href="/lancamentos/novo" variant="secondary">
          <PlusIcon size={18} /> Lançar à mão
        </LinkButton>
        <LinkButton href="/lancamentos/novo?tipo=transfer" variant="secondary">
          <ArrowsIcon size={18} /> Transferir
        </LinkButton>
      </div>

      {receipts.length > 0 && (
        <Card>
          <CardHeader title="Comprovantes recentes" />
          <ul className="mt-2 divide-y divide-line">
            {receipts.map((receipt) => {
              const status = STATUS[receipt.status];
              return (
                <li key={receipt.id}>
                  <Link href={`/comprovantes/${receipt.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <FileIcon size={20} className="shrink-0 text-ink-2" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{receipt.file_name ?? "Comprovante"}</p>
                      <p className="text-xs text-ink-2">
                        {formatDateBR(receipt.created_at.slice(0, 10))}
                        {receipt.uploaded_by ? ` · ${memberName.get(receipt.uploaded_by) ?? ""}` : ""}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <ChevronRightIcon size={18} className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="px-1 text-xs text-muted">
        No Android, com o app instalado, você também pode compartilhar o comprovante direto do app do banco para o
        Finanças. No iPhone, use os botões acima.
      </p>
    </div>
  );
}
