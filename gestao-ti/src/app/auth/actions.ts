"use server";

import { redirect } from "next/navigation";
import { entrar as fazerLogin, sairSessao } from "@/lib/auth";

export async function login(_prev: unknown, formData: FormData): Promise<{ erro?: string }> {
  const email = String(formData.get("email") || "");
  const senha = String(formData.get("senha") || "");
  const ok = await fazerLogin(email, senha);
  if (!ok) return { erro: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function sair() {
  await sairSessao();
  redirect("/login");
}
