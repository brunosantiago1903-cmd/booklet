#!/bin/sh
# Prepara os volumes e cria o administrador inicial (se configurado no .env).
set -e

mkdir -p /var/www/html/api/data /var/www/html/api/uploads

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_SENHA" ]; then
    php /var/www/html/api/seed_admin.php "$ADMIN_EMAIL" "$ADMIN_SENHA" "${ADMIN_NOME:-Administrador}"
fi

# Apache roda como www-data: precisa escrever no banco e nas fotos
chown -R www-data:www-data /var/www/html/api/data /var/www/html/api/uploads

exec "$@"
