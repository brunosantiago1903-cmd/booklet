import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { allowedEmails } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type Member = {
  id: string;
  household_id: string;
  display_name: string;
  email: string;
};

export type AppContext = {
  supabase: ServerSupabase;
  userId: string;
  email: string;
  member: Member;
  householdId: string;
};

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.split(/[._-]/)[0] ?? "Você";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Usuário logado + membro do casal. No primeiro acesso de um e-mail autorizado,
 * cria o vínculo (e o household, se ainda não existir). Memoizado por requisição.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const email = String(data.claims.email ?? "").toLowerCase();

  const memberQuery = async (householdId?: string) => {
    let query = supabase.from("members").select("id, household_id, display_name, email").eq("user_id", userId);
    // Filtro extra muda a URL: o Next memoiza GETs idênticos na mesma renderização,
    // e a releitura após o vínculo devolveria o resultado vazio anterior.
    if (householdId) query = query.eq("household_id", householdId);
    const { data: row, error } = await query.maybeSingle();
    if (error) throw new Error(`Não foi possível carregar o membro: ${error.message}`);
    return row;
  };

  let member = await memberQuery();
  if (!member) {
    if (!email || !allowedEmails().has(email)) redirect("/sem-acesso");
    const admin = createAdminClient();
    const { data: householdId, error } = await admin.rpc("bootstrap_member", {
      p_user_id: userId,
      p_email: email,
      p_display_name: displayNameFromEmail(email),
    });
    if (error || !householdId) throw new Error(`Não foi possível vincular o usuário: ${error?.message ?? "sem retorno"}`);
    member = await memberQuery(householdId);
    if (!member) throw new Error("Vínculo criado, mas o membro não foi encontrado.");
  }

  return { supabase, userId, email, member, householdId: member.household_id };
});
