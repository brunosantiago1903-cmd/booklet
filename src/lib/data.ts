import "server-only";
import type { CategoryRow } from "@/lib/categories";
import type { Tables } from "@/lib/database.types";
import type { ISODate } from "@/lib/dates";
import type { ServerSupabase } from "@/lib/supabase/server";

export type Account = Tables<"accounts"> & { balance_cents: number };
export type Transaction = Tables<"transactions">;

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Erro ao carregar ${what}: ${result.error.message}`);
  return result.data as T;
}

export async function listAccounts(
  supabase: ServerSupabase,
  { includeArchived = false } = {},
): Promise<Account[]> {
  let query = supabase.from("accounts").select("*").order("type").order("name");
  if (!includeArchived) query = query.eq("archived", false);
  const [accounts, balances] = await Promise.all([
    query,
    supabase.from("account_balances").select("account_id, balance_cents"),
  ]);
  const balanceById = new Map(check(balances, "saldos").map((b) => [b.account_id, Number(b.balance_cents)]));
  return check(accounts, "contas").map((account) => ({
    ...account,
    balance_cents: balanceById.get(account.id) ?? account.initial_balance_cents,
  }));
}

export async function getAccount(supabase: ServerSupabase, id: string): Promise<Account | null> {
  const [account, balance] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).maybeSingle(),
    supabase.from("account_balances").select("balance_cents").eq("account_id", id).maybeSingle(),
  ]);
  const row = check(account, "conta");
  if (!row) return null;
  return { ...row, balance_cents: Number(check(balance, "saldo")?.balance_cents ?? row.initial_balance_cents) };
}

export async function listCategories(supabase: ServerSupabase): Promise<CategoryRow[]> {
  return check(
    await supabase.from("categories").select("id, parent_id, name, kind, archived").order("name"),
    "categorias",
  );
}

export async function listMembers(supabase: ServerSupabase) {
  return check(
    await supabase.from("members").select("id, display_name, email, user_id").order("created_at"),
    "membros",
  );
}

export type TransactionFilters = {
  start?: ISODate;
  end?: ISODate;
  accountId?: string;
  categoryIds?: string[];
  uncategorized?: boolean;
  search?: string;
  invoiceMonth?: ISODate;
  limit?: number;
};

export async function listTransactions(
  supabase: ServerSupabase,
  filters: TransactionFilters,
): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);
  if (filters.start) query = query.gte("date", filters.start);
  if (filters.end) query = query.lt("date", filters.end);
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.invoiceMonth) query = query.eq("invoice_month", filters.invoiceMonth);
  if (filters.categoryIds?.length) query = query.in("category_id", filters.categoryIds);
  if (filters.uncategorized) query = query.is("category_id", null).neq("type", "transfer");
  if (filters.search) {
    const term = filters.search.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`description.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  return check(await query, "lançamentos");
}

export async function getTransaction(supabase: ServerSupabase, id: string): Promise<Transaction | null> {
  return check(await supabase.from("transactions").select("*").eq("id", id).maybeSingle(), "lançamento");
}

export async function listCardInvoices(supabase: ServerSupabase, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  return check(
    await supabase
      .from("card_invoices")
      .select("account_id, invoice_month, charges_cents, payments_cents, transaction_count")
      .in("account_id", accountIds)
      .order("invoice_month", { ascending: false }),
    "faturas",
  ).map((invoice) => ({
    ...invoice,
    charges_cents: Number(invoice.charges_cents),
    payments_cents: Number(invoice.payments_cents),
  }));
}

export async function listBudgets(supabase: ServerSupabase) {
  return check(await supabase.from("budgets").select("id, category_id, amount_cents"), "orçamentos").map((b) => ({
    ...b,
    amount_cents: Number(b.amount_cents),
  }));
}

export async function listRules(supabase: ServerSupabase) {
  return check(
    await supabase.from("category_rules").select("id, pattern, category_id").order("pattern"),
    "regras",
  );
}

export async function countUncategorized(supabase: ServerSupabase, start: ISODate, end: ISODate) {
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .is("category_id", null)
    .neq("type", "transfer")
    .gte("date", start)
    .lt("date", end);
  if (error) throw new Error(`Erro ao contar lançamentos sem categoria: ${error.message}`);
  return count ?? 0;
}

export async function listReceipts(supabase: ServerSupabase, { limit = 30 } = {}) {
  return check(
    await supabase
      .from("receipts")
      .select("id, status, file_name, mime_type, created_at, error, uploaded_by")
      .order("created_at", { ascending: false })
      .limit(limit),
    "comprovantes",
  );
}

export async function listBankConnections(supabase: ServerSupabase) {
  return check(
    await supabase
      .from("bank_connections")
      .select("id, label, client_id, item_id, member_id, last_synced_at, last_sync_status, last_error, created_at")
      .order("created_at"),
    "conexões",
  );
}
