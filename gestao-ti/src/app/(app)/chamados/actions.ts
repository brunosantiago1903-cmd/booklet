"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

export async function mudarStatusChamado(id: string, status: string) {
  await sql`update chamados set status = ${status}::status_chamado where id = ${id}`;
  revalidatePath("/chamados");
  revalidatePath("/");
}
