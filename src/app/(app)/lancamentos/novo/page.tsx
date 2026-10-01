import type { Metadata } from "next";
import { TransactionForm } from "@/components/transaction-form";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/categories";
import { listAccounts, listCategories } from "@/lib/data";
import { isISODate, isMonthKey, todayISO } from "@/lib/dates";
import { stringParam } from "@/lib/month-param";
import { centsToInput } from "@/lib/money";
import { saveTransaction } from "../actions";

export const metadata: Metadata = { title: "Novo lançamento" };

const KINDS = ["expense", "income", "refund", "transfer"] as const;
type Kind = (typeof KINDS)[number];

export default async function NewTransactionPage({ searchParams }: PageProps<"/lancamentos/novo">) {
  const { supabase } = await getAppContext();
  const params = await searchParams;
  const [accounts, categories] = await Promise.all([listAccounts(supabase), listCategories(supabase)]);

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Novo lançamento" back="/lancamentos" />
        <Card>
          <EmptyState title="Cadastre uma conta primeiro" action={<LinkButton href="/contas/nova">Cadastrar conta</LinkButton>} />
        </Card>
      </div>
    );
  }

  const tipo = stringParam(params.tipo);
  const kind: Kind = KINDS.includes(tipo as Kind) ? (tipo as Kind) : "expense";
  const to = stringParam(params.para);
  const from = stringParam(params.conta);
  const valueCents = Number(stringParam(params.valor));
  const fatura = stringParam(params.fatura);
  const data = stringParam(params.data);
  const checking = accounts.find((a) => a.type === "checking");
  const defaultAccount =
    accounts.find((a) => a.id === from) ?? (kind === "transfer" ? checking : undefined) ?? accounts[0];

  return (
    <div>
      <PageHeader title={kind === "transfer" ? "Transferência" : "Novo lançamento"} back="/lancamentos" />
      <Card className="p-4">
        <TransactionForm
          action={saveTransaction}
          mode="create"
          accounts={accounts}
          categories={buildCategoryOptions(categories)}
          defaults={{
            kind,
            accountId: defaultAccount.id,
            toAccountId: accounts.some((a) => a.id === to) ? to : undefined,
            amount: Number.isInteger(valueCents) && valueCents > 0 ? centsToInput(valueCents) : "",
            date: data && isISODate(data) ? data : todayISO(),
            description: kind === "transfer" && to ? "Pagamento da fatura" : "",
            categoryId: "",
            notes: "",
            installments: 1,
            invoiceMonth: fatura && isMonthKey(fatura) ? fatura : "",
          }}
        />
      </Card>
    </div>
  );
}
