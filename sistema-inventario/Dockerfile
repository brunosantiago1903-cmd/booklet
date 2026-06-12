FROM php:8.2-apache

# Habilita .htaccess (FallbackResource da API) e protege o banco de dados,
# já que o volume montado em api/data esconde o .htaccess do repositório.
RUN sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf \
    && printf '<Directory /var/www/html/api/data>\nRequire all denied\n</Directory>\n' \
       > /etc/apache2/conf-enabled/protege-banco.conf

COPY . /var/www/html/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && rm -f /var/www/html/docker-entrypoint.sh /var/www/html/Dockerfile \
       /var/www/html/docker-compose.yml /var/www/html/.dockerignore

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]
