# Gestão TI — Prefeitura de Morretes

App web + **PWA** para gestão de **equipe, tarefas, projetos e chamados** de TI,
com **notificações persistentes** (Web Push no celular + WhatsApp) e **portal
público de chamados**. Roda inteiro em **Docker**, sem depender de nuvem.

- **Stack:** Next.js 15 (App Router) · **Postgres** · login próprio (sessão JWT + bcrypt) · Web Push (VAPID) · WhatsApp Cloud API
- **Tudo containerizado:** `docker compose up` sobe banco + app

---

## 🚀 Subir em 5 passos

### 1. Pré-requisitos
- **Docker** e **Docker Compose** (você já tem).
- Para rodar os scripts de chave/usuário fora do container: **Node 20+** (opcional).

### 2. Configurar variáveis
```bash
cd gestao-ti
cp .env.example .env
```
Edite o `.env`:
- `POSTGRES_PASSWORD` → uma senha forte para o banco.
- `APP_SECRET` → gere com `openssl rand -base64 32`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` → gere com:
  ```bash
  npm install        # (uma vez, só para usar o gerador)
  npm run push:keys  # cole as duas linhas no .env
  ```

### 3. Subir os containers
```bash
docker compose up -d --build
```
O banco é criado **automaticamente** com todo o schema (`db/init/01-schema.sql`)
no primeiro start. O app fica em **http://localhost:3000**.

### 4. Criar o primeiro usuário (gestor)
```bash
docker compose exec app node scripts/criar-usuario.mjs \
  "voce@morretes.pr.gov.br" "suaSenhaForte" "Seu Nome" gestor
```
Depois entre no app e cadastre o resto da equipe na aba **👥 Equipe**
(só quem é `gestor` vê o formulário).

### 5. Instalar como app no celular (PWA)
Abra a URL no celular → menu do navegador → **Adicionar à tela inicial**.
No primeiro acesso, toque em **🔔 Ativar notificações**.

---

## 🌐 Produção (servidor de verdade, com HTTPS)
O **Web Push fora do localhost exige HTTPS**. Use o serviço **Caddy** incluído
(HTTPS automático via Let's Encrypt):

1. Aponte um domínio (ex.: `ti.morretes.pr.gov.br`) para o IP do servidor.
2. No `.env`: defina `DOMAIN=ti.morretes.pr.gov.br` e
   `NEXT_PUBLIC_APP_URL=https://ti.morretes.pr.gov.br`.
3. Suba com o perfil de produção:
   ```bash
   docker compose --profile prod up -d --build
   ```
O Caddy cuida do certificado sozinho. Pronto: acessível pela internet com cadeado.

> Sem domínio ainda? Dá para usar na rede interna por `http://IP-DO-SERVIDOR:3000`
> (o push só não funciona fora de `localhost` sem HTTPS).

---

## 🛠️ Rodar em modo desenvolvimento (sem Docker para o app)
```bash
docker compose up -d db          # só o banco no Docker
cp .env.example .env.local       # ajuste DATABASE_URL para localhost:5432
npm install
npm run dev                      # http://localhost:3000
```

## 📦 Comandos úteis
| Ação | Comando |
|---|---|
| Ver logs do app | `docker compose logs -f app` |
| Criar/atualizar usuário | `docker compose exec app node scripts/criar-usuario.mjs <email> <senha> "<nome>" [gestor\|tecnico]` |
| Backup do banco | `docker compose exec db pg_dump -U postgres gestao > backup.sql` |
| Parar tudo | `docker compose down` (dados ficam no volume `db_data`) |

## 🗂️ Estrutura
```
src/app/(app)/        Área logada: painel, tarefas, projetos, chamados, equipe
src/app/login/        Login da equipe
src/app/chamados/novo Portal PÚBLICO de chamados (sem login)
src/app/api/          Rotas de API (inscrição de push)
src/lib/db.ts         Conexão Postgres
src/lib/auth.ts       Login/sessão (JWT em cookie + bcrypt)
src/lib/notify.ts     Web Push + WhatsApp
db/init/01-schema.sql Banco completo (criado automático no Docker)
public/sw.js          Service worker (push + PWA)
Dockerfile            Imagem do app (Next standalone)
docker-compose.yml    Banco + app (+ Caddy no perfil "prod")
```

## 🔔 Notificações
- **Web Push:** ao atribuir uma tarefa, o responsável recebe push no celular/navegador.
- **Chamado novo:** os **gestores** são notificados automaticamente.
- **WhatsApp:** se `WHATSAPP_TOKEN` e o `telefone` do usuário estiverem preenchidos,
  a mesma mensagem vai por WhatsApp (configuração da Meta é opcional e pode ficar para depois).
