"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function mudarStatusChamado(id: string, status: string) {
  const supabase = await createClient();
  await supabase.from("chamados").update({ status }).eq("id", id);
  revalidatePath("/chamados");
  revalidatePath("/");
}
