#!/usr/bin/env bash
# Sobe um "Supabase" local mínimo para o teste de ponta a ponta:
#   Postgres (já instalado) + GoTrue (auth) + PostgREST (API) + gateway com Storage simulado.
# Requisitos: Postgres 15+ acessível em DATABASE_ADMIN_URL, psql, curl, node 22.
# Uso: bash e2e/start.sh   (depois: npm run build && npm start, e node e2e/run.mjs)
set -euo pipefail

cd "$(dirname "$0")"
E2E_DIR="$(pwd)"
CACHE="$E2E_DIR/.cache"
mkdir -p "$CACHE"

ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
DB_URL="${ADMIN_URL%/*}/financas_e2e"
PG_HOSTPORT="$(echo "$ADMIN_URL" | sed -E 's#^[a-z]+://[^@]+@([^/]+)/.*#\1#')"
POSTGREST_VERSION="v12.2.3"
GOTRUE_VERSION="v2.197.0"
JWT_SECRET="$(node -e 'import("./jwt.mjs").then(m => console.log(m.JWT_SECRET))')"

# 1. Binários (uma vez)
if [[ ! -x "$CACHE/postgrest" ]]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz" \
    | tar -xJ -C "$CACHE"
fi
if [[ ! -x "$CACHE/auth/auth" ]]; then
  mkdir -p "$CACHE/auth"
  curl -fsSL "https://github.com/supabase/auth/releases/download/${GOTRUE_VERSION}/auth-${GOTRUE_VERSION}-x86.tar.gz" \
    | tar -xz -C "$CACHE/auth"
fi

# 2. Para processos anteriores
bash "$E2E_DIR/stop.sh" >/dev/null 2>&1 || true
rm -rf "$CACHE/storage" && mkdir -p "$CACHE/storage"

# 3. Banco com roles no estilo Supabase
psql -X -q -v ON_ERROR_STOP=1 "$ADMIN_URL" <<'SQL'
drop database if exists financas_e2e with (force);
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'auth'; end if;
  if not exists (select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login createrole password 'auth'; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create database financas_e2e;
SQL
psql -X -q -v ON_ERROR_STOP=1 "$DB_URL" <<'SQL'
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
SQL

cat > "$CACHE/gotrue.env" <<EOF
GOTRUE_API_HOST=127.0.0.1
PORT=9999
API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:auth@${PG_HOSTPORT}/financas_e2e
GOTRUE_DB_MIGRATIONS_PATH=$CACHE/auth/migrations
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_JWT_SECRET=$JWT_SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_DISABLE_SIGNUP=true
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_LOG_LEVEL=warn
GOTRUE_PASSWORD_MIN_LENGTH=10
EOF
(set -a; source "$CACHE/gotrue.env"; set +a; "$CACHE/auth/auth" migrate >/dev/null)

psql -X -q -v ON_ERROR_STOP=1 "$DB_URL" <<'SQL'
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Storage simulado: mesmas tabelas/funções que as policies do app usam.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text not null, owner uuid, mimetype text, unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts, 1) - 1]; end; $$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
SQL
for migration in "$E2E_DIR"/../supabase/migrations/*.sql; do
  psql -X -q -v ON_ERROR_STOP=1 "$DB_URL" -f "$migration"
done

cat > "$CACHE/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:auth@${PG_HOSTPORT}/financas_e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
db-max-rows = 1000
log-level = "warn"
EOF

# 4. Serviços
(set -a; source "$CACHE/gotrue.env"; set +a; nohup "$CACHE/auth/auth" serve >"$CACHE/gotrue.log" 2>&1 & echo $! >"$CACHE/gotrue.pid")
nohup "$CACHE/postgrest" "$CACHE/postgrest.conf" >"$CACHE/postgrest.log" 2>&1 & echo $! >"$CACHE/postgrest.pid"
E2E_DB_URL="$DB_URL" nohup node "$E2E_DIR/gateway.mjs" >"$CACHE/gateway.log" 2>&1 & echo $! >"$CACHE/gateway.pid"
for _ in $(seq 1 60); do
  curl -fs -o /dev/null http://127.0.0.1:54321/auth/v1/health && break
  sleep 0.5
done

# 5. Variáveis do app e usuários de teste
node "$E2E_DIR/jwt.mjs" keys >"$CACHE/keys.env"
source "$CACHE/keys.env"
cat > "$E2E_DIR/../.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON
SUPABASE_SECRET_KEY=$SERVICE
ALLOWED_EMAILS=ana@teste.com,bruno@teste.com
APP_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
CRON_SECRET=segredo-cron-teste
EOF
cd "$E2E_DIR/.."
node scripts/create-user.mjs ana@teste.com "senha-da-ana-123" | head -1
node scripts/create-user.mjs bruno@teste.com "senha-do-bruno-123" | head -1
node scripts/create-user.mjs intruso@teste.com "senha-intruso-123" | head -1
echo "Supabase local em http://127.0.0.1:54321 (.env.local gerado)."
