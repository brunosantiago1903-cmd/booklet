# Gestão TI — Prefeitura de Morretes

App web + **PWA** para gestão de **equipe, tarefas, projetos e chamados** de TI,
com **notificações persistentes** (Web Push no celular + WhatsApp) e **portal
público de chamados**.

- **Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth) · Web Push (VAPID) · WhatsApp Cloud API
- **Hospedagem sugerida:** Vercel (grátis)

---

## 1. Pré-requisitos (contas gratuitas)
1. **Supabase** — https://supabase.com → crie um projeto.
2. **Vercel** — https://vercel.com (deploy).
3. *(Opcional)* **Meta WhatsApp Cloud API** — só quando quiser ativar o WhatsApp.

## 2. Banco de dados
No Supabase: **SQL Editor → New query**, cole todo o conteúdo de
[`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**.
Isso cria tabelas, papéis e a segurança (RLS), incluindo a permissão para
**qualquer pessoa abrir chamado** e só a equipe ler.

## 3. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | mesma tela (chave **service_role** — secreta) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | rode `npm run push:keys` |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Meta (opcional) |

## 4. Rodar localmente
```bash
npm install
npm run push:keys      # gera as chaves VAPID → cole no .env.local
npm run dev            # http://localhost:3000
```

## 5. Criar usuários da equipe
No Supabase → **Authentication → Users → Add user** (defina e-mail e senha).
O **perfil** é criado automaticamente. Depois, em **Table editor → profiles**,
ajuste `nome`, `cargo`, `papel` (`gestor`/`tecnico`) e `telefone`
(formato `5541999999999` para o WhatsApp).

## 6. Deploy na Vercel
1. Suba este diretório para um repositório.
2. Na Vercel: **New Project** → importe o repo → defina **Root Directory** = `gestao-ti`.
3. Cole as mesmas variáveis de ambiente.
4. Deploy. Ajuste `NEXT_PUBLIC_APP_URL` para a URL final.

## 7. Instalar como app (PWA)
Abra a URL no celular → menu do navegador → **Adicionar à tela inicial**.
No primeiro acesso, toque em **🔔 Ativar notificações**.

---

## Estrutura
```
src/app/(app)/        Área logada: painel, tarefas, projetos, chamados, equipe
src/app/login/        Login da equipe
src/app/chamados/novo Portal PÚBLICO de chamados (sem login)
src/lib/notify.ts     Envio de Web Push + WhatsApp
src/lib/supabase/     Clientes Supabase (browser/server/middleware)
supabase/schema.sql   Banco de dados completo
public/sw.js          Service worker (push + PWA)
```

## Notificações
- **Web Push:** ao atribuir uma tarefa, o responsável recebe push no celular/navegador.
- **WhatsApp:** se `WHATSAPP_TOKEN` e o `telefone` do perfil estiverem preenchidos,
  a mesma notificação vai por WhatsApp.
- **Lembrete de prazo:** ver `scripts/` e a seção de automação (cron diário) — em evolução.
