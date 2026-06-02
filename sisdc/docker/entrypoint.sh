#!/usr/bin/env sh
# Inicialização do container da aplicação SISDC (desenvolvimento).
set -e

cd /app

# Gera o .env a partir das variáveis do contêiner. Isso é necessário porque
# `php artisan serve` repassa ao processo-filho os valores do ARQUIVO .env;
# se ele apontasse para 127.0.0.1, as requisições web não achariam o banco.
cat > .env <<EOF
APP_NAME="${APP_NAME:-SISDC Morretes}"
APP_ENV=${APP_ENV:-local}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG:-true}
APP_URL=${APP_URL:-http://localhost:8000}
APP_LOCALE=${APP_LOCALE:-pt_BR}
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=pt_BR

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-sisdc}
DB_USERNAME=${DB_USERNAME:-sisdc}
DB_PASSWORD=${DB_PASSWORD:-secret}

SESSION_DRIVER=${SESSION_DRIVER:-database}
SESSION_LIFETIME=120
SESSION_DOMAIN=${SESSION_DOMAIN:-localhost}
SANCTUM_STATEFUL_DOMAINS=${SANCTUM_STATEFUL_DOMAINS:-localhost:8000}

CACHE_STORE=${CACHE_STORE:-database}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-database}
EOF

# Gera APP_KEY apenas se ainda não houver uma.
grep -q '^APP_KEY=base64' .env || php artisan key:generate --force

# Aguarda o PostgreSQL ficar disponível.
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
echo "Aguardando PostgreSQL em ${DB_HOST}:${DB_PORT}..."
until php -r 'exit(@fsockopen(getenv("DB_HOST"), (int) getenv("DB_PORT")) ? 0 : 1);'; do
    sleep 2
done

# Schema + dados de referência (programas sociais).
php artisan migrate --seed --force
# Usuários de demonstração (somente fora de produção; o seeder se autoignora em prod).
php artisan db:seed --class="Database\\Seeders\\DemoUsersSeeder" --force

echo "SISDC pronto em http://localhost:8000 (login: admin@morretes.pr.gov.br / senha-segura)"
exec php artisan serve --host=0.0.0.0 --port=8000
