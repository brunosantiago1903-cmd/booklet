#!/usr/bin/env node
// Cria (ou redefine a senha de) um usuário do app. O cadastro público fica desligado.
// Uso: npm run create-user -- email@exemplo.com "senha-com-10+-caracteres"
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do ambiente ou de .env.local.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const [email, password] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error('Uso: npm run create-user -- email@exemplo.com "senha"');
  process.exit(1);
}
if (password.length < 10) {
  console.error("A senha precisa ter pelo menos 10 caracteres.");
  process.exit(1);
}
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ambiente ou .env.local).");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const normalized = email.trim().toLowerCase();

const { data, error } = await admin.auth.admin.createUser({
  email: normalized,
  password,
  email_confirm: true,
});

if (!error) {
  console.log(`Usuário criado: ${data.user.email} (${data.user.id})`);
  console.log("Lembre de incluir o e-mail em ALLOWED_EMAILS.");
  process.exit(0);
}

if (error.code === "email_exists" || /already/i.test(error.message)) {
  // Já existe: redefine a senha.
  let page = 1;
  for (;;) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw listError;
    const user = list.users.find((u) => u.email?.toLowerCase() === normalized);
    if (user) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
      if (updateError) throw updateError;
      console.log(`Senha redefinida para ${normalized}.`);
      process.exit(0);
    }
    if (list.users.length < 200) break;
    page += 1;
  }
}

console.error(`Erro: ${error.message}`);
process.exit(1);
