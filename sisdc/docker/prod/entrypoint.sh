#!/usr/bin/env sh
# Inicialização de PRODUÇÃO do SISDC (nginx + php-fpm + queue via supervisor).
set -e

cd /app

# .env mínimo (em produção, prefira variáveis de ambiente / secrets do compose).
[ -f .env ] || cp .env.example .env
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
