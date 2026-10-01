import "server-only";
import { PluggyClient } from "pluggy-sdk";
import { decryptSecret } from "@/lib/crypto";
import { addDays, monthStart, todayISO } from "@/lib/dates";
import { encryptionKey } from "@/lib/env";
import { mapPluggyAccount, mapPluggyTransaction, pluggyDateToISO } from "@/lib/pluggy-map";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { importTransactions, type ImportResult } from "./import";

/** Histórico buscado na primeira sincronização. */
export const INITIAL_HISTORY_DAYS = 365;
/** Releitura de dias anteriores à última sincronização (pendentes viram compensados, ajustes do banco). */
export const RESYNC_OVERLAP_DAYS = 15;

export function pluggyClient(clientId: string, clientSecret: string): PluggyClient {
  return new PluggyClient({ clientId, clientSecret });
}

export function describePluggyError(error: unknown): string {
  const err = error as { response?: { statusCode?: number; body?: unknown }; message?: string };
  const status = err?.response?.statusCode;
  if (status === 401 || status === 403) return "Credenciais da Pluggy inválidas (Client ID / Client Secret).";
  if (status === 404) return "Item não encontrado na Pluggy. Confira o Item ID.";
  if (status === 429) return "Limite de requisições da Pluggy atingido. Tente mais tarde.";
  return err?.message ? `Pluggy: ${err.message}` : "Erro desconhecido na Pluggy.";
}

async function loadConnection(admin: AdminSupabase, connectionId: string) {
  const { data, error } = await admin.from("bank_connections").select("*").eq("id", connectionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conexão não encontrada.");
  return data;
}

/**
 * Lê as contas do item na Pluggy e garante um vínculo para cada uma.
 * Contas novas ganham uma conta correspondente no app automaticamente.
 */
export async function refreshConnectionAccounts(admin: AdminSupabase, connectionId: string): Promise<number> {
  const connection = await loadConnection(admin, connectionId);
  const client = pluggyClient(connection.client_id, decryptSecret(connection.client_secret_encrypted, encryptionKey()));
  const { results: remoteAccounts } = await client.fetchAccounts(connection.item_id);

  const { data: links, error } = await admin
    .from("bank_account_links")
    .select("id, external_account_id, account_id")
    .eq("connection_id", connectionId);
  if (error) throw new Error(error.message);
  const linkByExternal = new Map((links ?? []).map((l) => [l.external_account_id, l]));

  let created = 0;
  for (const remote of remoteAccounts) {
    const existing = linkByExternal.get(remote.id);
    if (existing) {
      await admin
        .from("bank_account_links")
        .update({ external_name: remote.marketingName || remote.name, external_type: remote.type, external_subtype: remote.subtype })
        .eq("id", existing.id);
      continue;
    }
    const draft = mapPluggyAccount(remote);
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({
        household_id: connection.household_id,
        owner_member_id: connection.member_id,
        name: draft.name,
        type: draft.type,
        institution: connection.label,
        closing_day: draft.closingDay,
        due_day: draft.dueDay,
        credit_limit_cents: draft.creditLimitCents,
      })
      .select("id")
      .single();
    if (accountError) throw new Error(accountError.message);
    const { error: linkError } = await admin.from("bank_account_links").insert({
      household_id: connection.household_id,
      connection_id: connectionId,
      external_account_id: remote.id,
      external_name: remote.marketingName || remote.name,
      external_type: remote.type,
      external_subtype: remote.subtype,
      account_id: account.id,
    });
    if (linkError) throw new Error(linkError.message);
    created += 1;
  }
  return created;
}

export type ConnectionSyncResult = ImportResult & { accounts: number; error?: string };

/** Busca os lançamentos de todas as contas vinculadas de uma conexão. */
export async function syncConnection(admin: AdminSupabase, connectionId: string): Promise<ConnectionSyncResult> {
  const total: ConnectionSyncResult = {
    inserted: 0,
    updated: 0,
    linked: 0,
    removed: 0,
    uncategorizedIds: [],
    accounts: 0,
  };
  const connection = await loadConnection(admin, connectionId);
  const startedAt = new Date().toISOString();

  try {
    const client = pluggyClient(
      connection.client_id,
      decryptSecret(connection.client_secret_encrypted, encryptionKey()),
    );
    const today = todayISO();
    const dateFrom = connection.last_synced_at
      ? addDays(connection.last_synced_at.slice(0, 10), -RESYNC_OVERLAP_DAYS)
      : addDays(today, -INITIAL_HISTORY_DAYS);

    const { data: links, error } = await admin
      .from("bank_account_links")
      .select("external_account_id, account_id")
      .eq("connection_id", connectionId)
      .not("account_id", "is", null);
    if (error) throw new Error(error.message);

    for (const link of links ?? []) {
      const { data: account, error: accountError } = await admin
        .from("accounts")
        .select("id, type, closing_day, due_day")
        .eq("id", link.account_id!)
        .maybeSingle();
      if (accountError) throw new Error(accountError.message);
      if (!account) continue;

      const transactions = await client.fetchAllTransactions(link.external_account_id, { dateFrom });
      const billInvoiceMonths = new Map<string, string>();
      if (account.type === "credit_card") {
        const bills = await client.fetchCreditCardBills(link.external_account_id);
        for (const bill of bills.results) {
          billInvoiceMonths.set(bill.id, monthStart(pluggyDateToISO(bill.dueDate)));
        }
      }

      const drafts = transactions.map((tx) =>
        mapPluggyTransaction(tx, {
          accountType: account.type,
          closingDay: account.closing_day,
          dueDay: account.due_day,
          billInvoiceMonths,
        }),
      );
      const result = await importTransactions(admin, {
        householdId: connection.household_id,
        accountId: account.id,
        source: "open_finance",
        drafts,
        pendingWindowStart: dateFrom,
      });
      total.inserted += result.inserted;
      total.updated += result.updated;
      total.linked += result.linked;
      total.removed += result.removed;
      total.uncategorizedIds.push(...result.uncategorizedIds);
      total.accounts += 1;
    }

    await admin
      .from("bank_connections")
      .update({ last_synced_at: startedAt, last_sync_status: "ok", last_error: null })
      .eq("id", connectionId);
  } catch (err) {
    const message = describePluggyError(err);
    await admin
      .from("bank_connections")
      .update({ last_sync_status: "error", last_error: message.slice(0, 500) })
      .eq("id", connectionId);
    total.error = message;
  }
  return total;
}
