# Imagem da aplicação SISDC (Laravel 11 + PHP 8.3).
FROM php:8.3-cli

# Extensões PHP necessárias (PostgreSQL/PostGIS, etc.) via instalador do mlocati.
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions \
    && install-php-extensions pdo_pgsql pgsql mbstring bcmath gd intl zip

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Instala dependências primeiro (cache de camada).
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-dev --no-scripts --no-autoloader

# Copia o restante da aplicação e finaliza o autoloader.
COPY . /app
RUN composer dump-autoload --optimize \
    && chmod +x docker/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["docker/entrypoint.sh"]
