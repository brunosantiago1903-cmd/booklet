import { timingSafeEqual } from "node:crypto";
import { cronSecret, isAiConfigured } from "@/lib/env";
import { categorizeWithAi } from "@/lib/server/categorize";
import { syncConnection } from "@/lib/server/pluggy";
import { createAdminClient } from "@/lib/supabase/admin";

// Sincronização pode levar alguns minutos na primeira vez (12 meses de histórico).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Chamado diariamente pela Vercel (vercel.json). A Vercel envia "Authorization: Bearer CRON_SECRET". */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connections, error } = await admin.from("bank_connections").select("id, household_id, label");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const report: Record<string, unknown>[] = [];
  const households = new Set<string>();
  for (const connection of connections ?? []) {
    const result = await syncConnection(admin, connection.id);
    households.add(connection.household_id);
    report.push({
      connection: connection.label,
      accounts: result.accounts,
      inserted: result.inserted,
      updated: result.updated,
      linked: result.linked,
      removed: result.removed,
      error: result.error ?? null,
    });
  }

  const categorized: Record<string, number | string> = {};
  if (isAiConfigured()) {
    for (const householdId of households) {
      try {
        categorized[householdId] = await categorizeWithAi(admin, householdId, { limit: 160 });
      } catch (err) {
        categorized[householdId] = err instanceof Error ? err.message : "erro";
      }
    }
  }

  return Response.json({ ok: true, connections: report, categorized });
}
