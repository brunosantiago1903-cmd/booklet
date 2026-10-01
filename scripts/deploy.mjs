#!/usr/bin/env node
// Implanta o app do zero: projeto Supabase (banco, auth, storage, usuários) + Vercel (variáveis e deploy).
// Rode no seu computador, na pasta do projeto, depois de `npm install`:
//   node scripts/deploy.mjs            (interativo)
//   node scripts/deploy.mjs --dry-run  (só mostra o que faria)
// Opcional: SUPABASE_ACCESS_TOKEN e VERCEL_TOKEN no ambiente para não precisar digitar/logar.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const DRY = process.argv.includes("--dry-run");
const IS_WINDOWS = process.platform === "win32";
const REGION = "sa-east-1";
const rl = createInterface({ input: process.stdin, terminal: false });
// Fila de linhas: funciona no terminal e com entrada redirecionada (pipe).
const lines = rl[Symbol.asyncIterator]();

function log(message) {
  console.log(`\n▸ ${message}`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

async function ask(question, fallback = "") {
  process.stdout.write(`${question}${fallback ? ` [${fallback}]` : ""}: `);
  const next = await lines.next();
  if (next.done) fail("Entrada encerrada antes do fim.");
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return next.value.trim() || fallback;
}

/** Pergunta sem ecoar o que é digitado (senhas e tokens). */
async function askHidden(question) {
  if (!process.stdin.isTTY) return ask(question);
  rl.pause();
  process.stdout.write(`${question}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    const onData = (buffer) => {
      for (const char of buffer.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          rl.resume();
          resolve(value.trim());
          return;
        }
        if (char === "\u0003") process.exit(130);
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

/** Executa um comando (npx ...) e devolve stdout. Em --dry-run só imprime. */
function run(command, args, { env = {}, input, secret = [], allowFail = false, inherit = false } = {}) {
  const shown = [command, ...args].map((a) => (secret.includes(a) ? "***" : a)).join(" ");
  if (DRY) {
    console.log(`  $ ${shown}`);
    return "";
  }
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env },
    input,
    encoding: "utf8",
    shell: IS_WINDOWS,
    stdio: inherit ? "inherit" : ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0 && !allowFail) {
    fail(`Falhou: ${shown}\n${result.stderr ?? ""}${result.stdout ?? ""}`);
  }
  return result.status === 0 ? (result.stdout ?? "") : null;
}

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`Resposta inesperada ao ler ${what}:\n${text.slice(0, 500)}`);
  }
}

function writeLocal(file, content) {
  if (DRY) {
    console.log(`  (simulação: não grava ${file})`);
    return;
  }
  writeFileSync(file, content, { mode: 0o600 });
}

/** Management API da Supabase (mesma usada pela CLI). */
async function supabaseApi(token, method, path, body) {
  if (DRY) {
    console.log(`  $ ${method} https://api.supabase.com${path} ${JSON.stringify(body)}`);
    return null;
  }
  const response = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) fail(`Supabase API ${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Implantação do Finanças do casal (Supabase + Vercel)" + (DRY ? " — simulação" : ""));
  if (!existsSync("supabase/migrations")) fail("Rode este script na pasta raiz do projeto.");
  if (Number(process.versions.node.split(".")[0]) < 22) fail("Use Node.js 22 ou mais novo.");

  // ---------------------------------------------------------------- Supabase
  log("Supabase");
  const supabaseToken =
    process.env.SUPABASE_ACCESS_TOKEN ||
    (await askHidden("Token de acesso da Supabase (supabase.com/dashboard/account/tokens)"));
  if (!supabaseToken && !DRY) fail("Token da Supabase é obrigatório.");
  const sbEnv = { SUPABASE_ACCESS_TOKEN: supabaseToken };
  const supabase = (args, options = {}) => run("npx", ["supabase", ...args], { env: sbEnv, ...options });

  const orgs = DRY ? [{ id: "org-exemplo", name: "Minha organização" }] : parseJson(supabase(["orgs", "list", "-o", "json"]), "organizações");
  if (!Array.isArray(orgs) || orgs.length === 0) fail("Nenhuma organização na Supabase. Crie uma em supabase.com.");
  let org = orgs[0];
  if (orgs.length > 1) {
    orgs.forEach((o, i) => console.log(`  ${i + 1}. ${o.name} (${o.id})`));
    org = orgs[Number(await ask("Número da organização", "1")) - 1] ?? orgs[0];
  }

  const projectName = await ask("Nome do projeto", "financas-casal");
  const projects = DRY ? [] : parseJson(supabase(["projects", "list", "-o", "json"]), "projetos");
  const existing = (Array.isArray(projects) ? projects : []).find((p) => p.name === projectName);
  let ref;
  let dbPassword;
  if (existing) {
    ref = existing.ref ?? existing.id;
    console.log(`  Projeto existente encontrado: ${ref}`);
    dbPassword = await askHidden("Senha do banco desse projeto");
  } else {
    dbPassword = randomBytes(18).toString("base64url");
    const createOutput = supabase(
      ["projects", "create", projectName, "--org-id", org.id, "--db-password", dbPassword, "--region", REGION, "-o", "json"],
      { secret: [dbPassword] },
    );
    const created = DRY ? { ref: "abcdefghijklmnopqrst" } : parseJson(createOutput, "projeto criado");
    ref = created.ref ?? created.id;
    if (!ref) fail("Não consegui identificar o ref do projeto criado.");
    console.log(`  Projeto criado: ${ref} (região ${REGION})`);
  }
  writeLocal(
    ".env.deploy",
    `# Gerado por scripts/deploy.mjs — guarde em local seguro e não versione.\nSUPABASE_PROJECT_REF=${ref}\nSUPABASE_DB_PASSWORD=${dbPassword}\n`,
  );

  log("Aguardando o projeto ficar pronto (pode levar alguns minutos)");
  let keys = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const output = supabase(["projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"], { allowFail: true });
    if (DRY) {
      keys = [
        { name: "publishable", api_key: "sb_publishable_exemplo" },
        { name: "secret", api_key: "sb_secret_exemplo" },
      ];
      break;
    }
    if (output) {
      keys = parseJson(output, "chaves de API");
      if (Array.isArray(keys) && keys.length > 0) break;
    }
    await sleep(10_000);
  }
  const keyValue = (k) => k.api_key ?? k.apiKey ?? k.key ?? "";
  const publishable =
    keys.map(keyValue).find((k) => k.startsWith("sb_publishable_")) ??
    keyValue(keys.find((k) => k.name === "anon") ?? {});
  const secret =
    keys.map(keyValue).find((k) => k.startsWith("sb_secret_")) ??
    keyValue(keys.find((k) => k.name === "service_role") ?? {});
  if (!publishable || !secret) fail("Não consegui ler as chaves de API do projeto. Rode de novo em alguns minutos.");
  const supabaseUrl = `https://${ref}.supabase.co`;

  log("Aplicando o banco (migrations, RLS e bucket de comprovantes)");
  // O banco de um projeto novo leva alguns minutos para aceitar conexões: tenta de novo.
  for (const args of [
    ["link", "--project-ref", ref, "--password", dbPassword],
    ["db", "push", "--linked", "--password", dbPassword, "--yes"],
  ]) {
    for (let attempt = 1; ; attempt += 1) {
      const ok = supabase(args, { secret: [dbPassword], allowFail: attempt < 12 });
      if (ok !== null || DRY) break;
      console.log(`  banco ainda subindo, nova tentativa em 20 s (${attempt}/12)`);
      await sleep(20_000);
    }
  }

  log("Configurando o login (cadastro público desligado, senha mínima de 10)");
  await supabaseApi(supabaseToken, "PATCH", `/v1/projects/${ref}/config/auth`, {
    disable_signup: true,
    password_min_length: 10,
  });

  // ---------------------------------------------------------------- Usuários e segredos
  log("Usuários do casal");
  const users = [];
  for (const label of ["primeira pessoa", "segunda pessoa"]) {
    const email = (await ask(`E-mail da ${label}`)).toLowerCase();
    let password = "";
    while (password.length < 10) {
      password = await askHidden(`Senha de ${email || label} (mín. 10 caracteres)`);
      if (password.length < 10) console.log("  A senha precisa ter pelo menos 10 caracteres.");
      if (DRY) break;
    }
    users.push({ email, password });
  }
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY ||
    (await askHidden("Chave da API da Anthropic (console.anthropic.com) — Enter para pular"));

  const appEnv = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SECRET_KEY: secret,
    ALLOWED_EMAILS: users.map((u) => u.email).join(","),
    APP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    CRON_SECRET: randomBytes(24).toString("hex"),
    ...(anthropicKey ? { ANTHROPIC_API_KEY: anthropicKey } : {}),
  };

  for (const user of users) {
    run("node", ["scripts/create-user.mjs", user.email, user.password], {
      env: { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SECRET_KEY: secret },
      secret: [user.password],
    });
    console.log(`  Usuário pronto: ${user.email}`);
  }

  // ---------------------------------------------------------------- Vercel
  log("Vercel");
  const vercelToken = process.env.VERCEL_TOKEN || "";
  const tokenArgs = vercelToken ? ["--token", vercelToken] : [];
  const vercel = (args, options = {}) =>
    run("npx", ["vercel", ...args, ...tokenArgs], { secret: [vercelToken], ...options });
  if (!vercelToken && !DRY) {
    console.log("  Sem VERCEL_TOKEN: a CLI vai pedir login no navegador.");
    run("npx", ["vercel", "login"], { inherit: true });
  }
  vercel(["link", "--yes", "--project", projectName]);

  const publicVars = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "ALLOWED_EMAILS"]);
  for (const [name, value] of Object.entries(appEnv)) {
    vercel(
      ["env", "add", name, "production", "--value", value, "--force", "--yes", publicVars.has(name) ? "--no-sensitive" : "--sensitive"],
      { secret: [value] },
    );
    console.log(`  ${name} configurada`);
  }

  log("Publicando (build na Vercel)");
  const deployOutput = vercel(["deploy", "--prod", "--yes"]);
  const productionUrl = DRY ? "https://financas-casal.vercel.app" : (deployOutput.match(/https:\/\/[^\s]+/g) ?? []).pop();

  if (productionUrl) {
    await supabaseApi(supabaseToken, "PATCH", `/v1/projects/${ref}/config/auth`, {
      site_url: productionUrl,
      uri_allow_list: `${productionUrl}/**`,
    });
  }

  // Variáveis locais para desenvolvimento.
  writeLocal(
    ".env.local",
    Object.entries(appEnv)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );

  console.log(`
✔ Pronto${DRY ? " (simulação)" : ""}!
  App:        ${productionUrl ?? "veja a URL no painel da Vercel"}
  Supabase:   ${supabaseUrl}
  Segredos:   .env.deploy (senha do banco) e .env.local — não versione.

Próximos passos:
  1. Abra o app no celular e instale (iPhone: Compartilhar → Adicionar à Tela de Início; Android: Instalar app).
  2. Opcional: Mais → Open Finance para conectar o Meu Pluggy.
`);
}

main()
  .catch((err) => fail(err instanceof Error ? err.message : String(err)))
  .finally(() => {
    rl.close();
    process.stdin.destroy();
  });
