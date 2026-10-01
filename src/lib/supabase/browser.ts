import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = supabasePublicEnv();
  return createBrowserClient<Database>(url, key);
}
