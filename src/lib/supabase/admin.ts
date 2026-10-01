import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabasePublicEnv, supabaseSecretKey } from "@/lib/env";

/**
 * Cliente com a chave secreta: ignora RLS. Usar só no servidor, para o vínculo inicial
 * de membros, a sincronização agendada e a leitura do segredo da Pluggy.
 */
export function createAdminClient() {
  return createClient<Database>(supabasePublicEnv().url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
