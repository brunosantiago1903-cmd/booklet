# Rodar o SISDC na sua máquina (Docker)

Guia rápido para subir o sistema completo (app + PostgreSQL/PostGIS) com um comando.

## Pré-requisito (instala só isto, uma vez)

- **Docker Desktop** — https://www.docker.com/products/docker-desktop/
  (Windows, macOS ou Linux). Não precisa instalar PHP, PostgreSQL nem Node.

## Passos

```bash
# 1) Baixar o código (ou usar a pasta que você já tem)
git clone https://github.com/brunosantiago1903-cmd/booklet
cd booklet/sisdc

# 2) Subir tudo (builda os assets, sobe o banco PostGIS, migra e semeia)
docker compose up --build
```

Aguarde aparecer **"SISDC pronto em http://localhost:8000"** no terminal.

## Acessar

Abra no navegador: **http://localhost:8000/login**

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@morretes.pr.gov.br` | `senha-segura` |
| Auditor | `auditor@morretes.pr.gov.br` | `senha-segura` |
| Operador | `operador@morretes.pr.gov.br` | `senha-segura` |

- **Mapa de risco:** menu **Mapa**
- **Validar cadastros:** menu **Auditoria** (admin/auditor)
- **Coletar em campo (PWA offline):** menu **Coleta de campo** (admin/operador)

## Comandos úteis

```bash
# Parar (mantém os dados)
docker compose down

# Parar e APAGAR os dados do banco
docker compose down -v

# Criar um usuário com senha segura (recomendado no lugar dos de demo)
docker compose exec app php artisan sisdc:usuario

# Ver logs
docker compose logs -f app
```

## Problemas comuns

- **`toomanyrequests` / rate limit ao baixar imagens:** faça `docker login`
  (conta grátis do Docker Hub) e rode `docker compose up --build` de novo.
- **Porta 8000 ocupada:** edite `ports` em `docker-compose.yml` para `"8001:8000"`
  e acesse http://localhost:8001.
- **Primeira subida demora:** é normal (baixa imagens e builda os assets);
  as próximas são rápidas.

> Para **produção** (nginx + php-fpm, sem dados de demo, segredos por env),
> use `docker compose -f docker-compose.prod.yml up -d --build` — veja o README.
