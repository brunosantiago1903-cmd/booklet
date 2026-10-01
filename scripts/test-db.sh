#!/usr/bin/env bash
# Aplica as migrations num Postgres local (com stubs mínimos do Supabase) e roda os testes SQL.
# Uso: DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
set -euo pipefail

cd "$(dirname "$0")/.."

ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB_NAME="${TEST_DB_NAME:-financas_test}"
TEST_URL="${ADMIN_URL%/*}/${DB_NAME}"

psql_run() {
  psql -X -q -v ON_ERROR_STOP=1 "$@"
}

psql_run "$ADMIN_URL" -c "drop database if exists ${DB_NAME} with (force)"
psql_run "$ADMIN_URL" -c "create database ${DB_NAME}"

psql_run "$TEST_URL" -f supabase/tests/00_supabase_stub.sql
for migration in supabase/migrations/*.sql; do
  echo "aplicando ${migration}"
  psql_run "$TEST_URL" -f "$migration"
done

echo "rodando supabase/tests/database.test.sql"
psql_run "$TEST_URL" -o /dev/null -f supabase/tests/database.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'

psql_run "$ADMIN_URL" -c "drop database if exists ${DB_NAME} with (force)"
echo "banco: todos os testes passaram"
