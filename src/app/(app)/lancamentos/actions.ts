"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import type { TablesUpdate } from "@/lib/database.types";
import { addDays, diffDays, invoiceFor, invoicePaidOn, isISODate, isMonthKey, monthKeyOf } from "@/lib/dates";
import { RECONCILE_TOLERANCE_DAYS } from "@/lib/reconcile";
import { parseMoneyToCents } from "@/lib/money";
import { upsertRuleAndApply } from "@/lib/server/rules";
import { buildNewTransactionRows, kindToType, signedAmount } from "@/lib/transaction-builder";

export type TransactionFormState = { error: string | null };

const formSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["expense", "income", "refund", "transfer"]),
  account_id: z.uuid({ error: "Escolha a conta ou cartão." }),
  to_account_id: z.uuid().optional(),
  amount: z.string().optional(),
  date: z.string().optional(),
  description: z.string().trim().min(1, "Informe uma descrição.").max(200),
  category_id: z.uuid().optional(),
  notes: z.string().max(1000).optional(),
  installments: z.coerce.number().int().min(1).max(48).optional(),
  invoice_month: z.string().optional(),
  receipt_id: z.uuid().optional(),
  create_rule: z.literal("on").optional(),
  rule_pattern: z.string().max(80).optional(),
  return_to: z.string().optional(),
});

function emptyToUndefined(formData: FormData): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "") entries[key] = value;
  }
  return entries;
}

function safeReturn(value: string | undefined, fallback: string): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

type Db = Awaited<ReturnType<typeof getAppContext>>["supabase"];

/** Lançamento importado do banco (sem comprovante) com mesma conta e valor, até 3 dias de diferença. */
async function findImportedMatch(db: Db, accountId: string, amountCents: number, date: string) {
  const { data, error } = await db
    .from("transactions")
    .select("id, date, notes, category_id")
    .eq("account_id", accountId)
    .eq("amount_cents", amountCents)
    .in("source", ["open_finance", "ofx"])
    .is("receipt_id", null)
    .gte("date", addDays(date, -RECONCILE_TOLERANCE_DAYS))
    .lte("date", addDays(date, RECONCILE_TOLERANCE_DAYS));
  if (error) throw new Error(error.message);
  return (data ?? []).sort((a, b) => Math.abs(diffDays(a.date, date)) - Math.abs(diffDays(b.date, date)))[0] ?? null;
}

export async function saveTransaction(_prev: TransactionFormState, formData: FormData): Promise<TransactionFormState> {
  const parsed = formSchema.safeParse(emptyToUndefined(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const input = parsed.data;
  const { supabase, member, householdId } = await getAppContext();

  const invoiceMonth =
    input.invoice_month && isMonthKey(input.invoice_month) ? `${input.invoice_month}-01` : null;
  const categoryId = input.kind === "transfer" ? null : (input.category_id ?? null);
  let destination: string;

  try {
    if (!input.id) {
      const amountCents = input.amount ? parseMoneyToCents(input.amount) : null;
      if (amountCents === null || amountCents === 0) return { error: "Informe um valor válido." };
      if (!input.date || !isISODate(input.date)) return { error: "Informe uma data válida." };

      const accountIds = [input.account_id, input.to_account_id].filter((id): id is string => !!id);
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id, type, closing_day, due_day")
        .in("id", accountIds);
      if (error) throw new Error(error.message);
      const account = accounts?.find((a) => a.id === input.account_id);
      if (!account) return { error: "Conta não encontrada." };
      const toAccount = input.to_account_id ? (accounts?.find((a) => a.id === input.to_account_id) ?? null) : null;

      const rows = buildNewTransactionRows({
        kind: input.kind,
        account,
        toAccount,
        amountCents: Math.abs(amountCents),
        date: input.date,
        description: input.description,
        categoryId,
        notes: input.notes ?? null,
        installments: input.installments ?? 1,
        invoiceMonth,
        source: input.receipt_id ? "receipt" : "manual",
        receiptId: input.receipt_id ?? null,
        createdBy: member.id,
        newId: () => crypto.randomUUID(),
      }).map((row) => ({ ...row, household_id: householdId }));

      // Comprovante de um gasto que já veio do banco: vincula em vez de duplicar.
      const bankMatch =
        input.receipt_id && rows.length === 1 && input.kind !== "transfer"
          ? await findImportedMatch(supabase, rows[0].account_id, rows[0].amount_cents, input.date)
          : null;

      if (bankMatch) {
        const { error: linkError } = await supabase
          .from("transactions")
          .update({
            receipt_id: input.receipt_id,
            notes: bankMatch.notes ?? (input.notes?.trim() || null),
            ...(bankMatch.category_id || !categoryId ? {} : { category_id: categoryId, category_source: "user" as const }),
          })
          .eq("id", bankMatch.id);
        if (linkError) throw new Error(linkError.message);
      } else {
        const { error: insertError } = await supabase.from("transactions").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }

      if (input.receipt_id) {
        await supabase.from("receipts").update({ status: "confirmed" }).eq("id", input.receipt_id);
      }
      destination = bankMatch
        ? `/lancamentos/${bankMatch.id}`
        : safeReturn(input.return_to, `/lancamentos?mes=${monthKeyOf(input.date)}`);
    } else {
      const { data: existing, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", input.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!existing) return { error: "Lançamento não encontrado." };

      const imported = existing.source === "open_finance" || existing.source === "ofx";
      const amountCents = input.amount ? parseMoneyToCents(input.amount) : null;
      const date = input.date && isISODate(input.date) ? input.date : existing.date;
      if (!imported && (amountCents === null || amountCents === 0)) return { error: "Informe um valor válido." };
      if (imported && existing.amount_cents < 0 && (input.kind === "income" || input.kind === "refund")) {
        return { error: "Este lançamento do banco é uma saída: use despesa ou transferência." };
      }
      if (imported && existing.amount_cents > 0 && input.kind === "expense") {
        return { error: "Este lançamento do banco é uma entrada: use receita, estorno ou transferência." };
      }

      if (existing.transfer_group_id) {
        // Transferência manual: as duas pernas mudam juntas.
        const abs = imported || amountCents === null ? Math.abs(existing.amount_cents) : Math.abs(amountCents);
        const { data: legs, error: legsError } = await supabase
          .from("transactions")
          .select("id, amount_cents, account_id, source")
          .eq("transfer_group_id", existing.transfer_group_id);
        if (legsError) throw new Error(legsError.message);
        for (const leg of legs ?? []) {
          const legImported = leg.source === "open_finance" || leg.source === "ofx";
          const update: TablesUpdate<"transactions"> = {
            description: input.description,
            notes: input.notes ?? null,
          };
          if (!legImported) {
            update.amount_cents = leg.amount_cents < 0 ? -abs : abs;
            update.date = date;
          }
          if (leg.id === existing.id && invoiceMonth) update.invoice_month = invoiceMonth;
          const { error: legError } = await supabase.from("transactions").update(update).eq("id", leg.id);
          if (legError) throw new Error(legError.message);
        }
      } else {
        const accountId = imported ? existing.account_id : input.account_id;
        const { data: account, error: accountError } = await supabase
          .from("accounts")
          .select("id, type, closing_day, due_day")
          .eq("id", accountId)
          .maybeSingle();
        if (accountError) throw new Error(accountError.message);
        if (!account) return { error: "Conta não encontrada." };

        const type = kindToType(input.kind);
        let amount = existing.amount_cents;
        if (!imported && amountCents !== null) {
          amount =
            input.kind === "transfer"
              ? Math.sign(existing.amount_cents || -1) * Math.abs(amountCents)
              : signedAmount(input.kind, amountCents);
        }

        let nextInvoice: string | null = null;
        if (account.type === "credit_card" && account.closing_day && account.due_day) {
          const dateChanged = date !== existing.date || accountId !== existing.account_id;
          nextInvoice =
            invoiceMonth ??
            (dateChanged || !existing.invoice_month
              ? type === "transfer" && amount > 0
                ? invoicePaidOn(date, account.closing_day, account.due_day)
                : invoiceFor(date, account.closing_day, account.due_day).invoiceMonth
              : existing.invoice_month);
        }

        const update: TablesUpdate<"transactions"> = {
          type,
          description: input.description,
          notes: input.notes ?? null,
          category_id: categoryId,
          category_source: categoryId
            ? categoryId === existing.category_id
              ? existing.category_source
              : "user"
            : null,
          invoice_month: nextInvoice,
        };
        if (!imported) {
          update.account_id = accountId;
          update.amount_cents = amount;
          update.date = date;
        }
        const { error: updateError } = await supabase.from("transactions").update(update).eq("id", existing.id);
        if (updateError) throw new Error(updateError.message);

        if (existing.installment_group_id) {
          // Descrição e categoria valem para todas as parcelas.
          const { error: groupError } = await supabase
            .from("transactions")
            .update({ description: input.description, category_id: categoryId, category_source: update.category_source })
            .eq("installment_group_id", existing.installment_group_id)
            .neq("id", existing.id);
          if (groupError) throw new Error(groupError.message);
        }
      }
      destination = safeReturn(input.return_to, `/lancamentos?mes=${monthKeyOf(date)}`);
    }

    if (input.create_rule && categoryId && input.rule_pattern) {
      await upsertRuleAndApply(supabase, { householdId, pattern: input.rule_pattern, categoryId });
    }
  } catch (err) {
    return { error: err instanceof Error ? `Não foi possível salvar: ${err.message}` : "Não foi possível salvar." };
  }

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const scope = String(formData.get("scope") ?? "one");
  const returnTo = safeReturn(String(formData.get("return_to") ?? ""), "/lancamentos");
  const { supabase } = await getAppContext();

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, transfer_group_id, installment_group_id, receipt_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) redirect(returnTo);

  let query = supabase.from("transactions").delete();
  if (existing.transfer_group_id) {
    query = query.eq("transfer_group_id", existing.transfer_group_id);
  } else if (existing.installment_group_id && scope === "all") {
    query = query.eq("installment_group_id", existing.installment_group_id);
  } else {
    query = query.eq("id", existing.id);
  }
  const { error } = await query;
  if (error) throw new Error(`Não foi possível excluir: ${error.message}`);

  if (existing.receipt_id) {
    // O comprovante volta para a fila de revisão.
    await supabase.from("receipts").update({ status: "extracted" }).eq("id", existing.receipt_id).eq("status", "confirmed");
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}
