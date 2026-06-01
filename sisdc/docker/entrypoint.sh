#!/usr/bin/env sh
# Inicialização do container da aplicação SISDC.
set -e

cd /app

# Garante um .env (as variáveis do compose têm precedência sobre o arquivo).
[ -f .env ] || cp .env.example .env

# Gera APP_KEY apenas se ainda não houver uma.
grep -q '^APP_KEY=base64' .env || php artisan key:generate --force

# Aguarda o PostgreSQL ficar disponível.
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
echo "Aguardando PostgreSQL em ${DB_HOST}:${DB_PORT}..."
until php -r 'exit(@fsockopen(getenv("DB_HOST"), (int) getenv("DB_PORT")) ? 0 : 1);'; do
    sleep 2
done

# Schema + dados iniciais (idempotente: usuários e programas via updateOrCreate).
php artisan migrate --seed --force

echo "SISDC pronto em http://localhost:8000 (login: admin@morretes.pr.gov.br / senha-segura)"
exec php artisan serve --host=0.0.0.0 --port=8000
