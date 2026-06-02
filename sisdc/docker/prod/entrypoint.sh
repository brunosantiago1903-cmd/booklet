#!/usr/bin/env sh
# Inicialização de PRODUÇÃO do SISDC (nginx + php-fpm + queue via supervisor).
set -e

cd /app

# Gera o .env a partir das variáveis/secrets do contêiner.
cat > .env <<EOF
APP_NAME="${APP_NAME:-SISDC Morretes}"
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-https://localhost}
APP_LOCALE=${APP_LOCALE:-pt_BR}

LOG_CHANNEL=stack
LOG_LEVEL=warning

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-sisdc}
DB_USERNAME=${DB_USERNAME:-sisdc}
DB_PASSWORD=${DB_PASSWORD:-secret}

SESSION_DRIVER=${SESSION_DRIVER:-database}
SESSION_SECURE_COOKIE=${SESSION_SECURE_COOKIE:-true}
SESSION_DOMAIN=${SESSION_DOMAIN:-}
SANCTUM_STATEFUL_DOMAINS=${SANCTUM_STATEFUL_DOMAINS:-}

CACHE_STORE=${CACHE_STORE:-database}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-database}
EOF
grep -q '^APP_KEY=base64' .env || php artisan key:generate --force

# Aguarda o PostgreSQL.
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
echo "Aguardando PostgreSQL em ${DB_HOST}:${DB_PORT}..."
until php -r 'exit(@fsockopen(getenv("DB_HOST"), (int) getenv("DB_PORT")) ? 0 : 1);'; do
    sleep 2
done

# Migrações e dados de referência (SEM usuários — crie com sisdc:usuario).
php artisan migrate --force
php artisan db:seed --class="Database\\Seeders\\ProgramaSocialSeeder" --force

# Caches de produção.
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data storage bootstrap/cache

echo "SISDC (produção) no ar. Crie o admin: docker compose -f docker-compose.prod.yml exec app php artisan sisdc:usuario"
exec supervisord -c docker/prod/supervisord.conf
