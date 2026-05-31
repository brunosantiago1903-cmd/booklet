# SISDC — Sistema de Gestão de Defesa Civil de Morretes-PR

PWA **Offline-First** para levantamento de risco e vulnerabilidade socioambiental
em campo, com sincronização ao reconectar e painel administrativo com mapa de risco.

> Baseado no *Formulário para análise de riscos e vulnerabilidade socioambiental
> no município de Morretes – PR* (SISDC).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Laravel 11 · PHP 8.3+ |
| Banco | PostgreSQL + **PostGIS** (`GEOGRAPHY(POINT, 4326)`) |
| Frontend painel | Blade · TailwindCSS · Leaflet.js |
| PWA | Service Worker · IndexedDB (`idb`) · Background Sync |
| Auth | Laravel Sanctum (híbrido: sessão no painel, Bearer token no tablet) + RBAC |
| Infra | Servidor interno via Cloudflare Tunnel |

## Estrutura do domínio

```
cadastros (domicílio/ocorrência) ── 1:N ── habitantes
        │                          ── 1:N ── historico_riscos   (linha do tempo de risco)
        │                          ── 1:1 ── vulnerabilidade_saude
        │                          ── 1:1 ── infraestruturas
        │                          ── 1:1 ── riscos_ambientais
        │                          ── 1:1 ── agriculturas
        │                          ── N:N ── programas_sociais
        └── morph ── anexos (fotos)
```

- **Geolocalização**: `cadastros.localizacao` e `historico_riscos.localizacao`
  são `GEOGRAPHY(POINT, 4326)` com índice GIST. `latitude`/`longitude` ficam
  também em colunas numéricas para exibição e trânsito offline.
- **Histórico de risco**: cada avaliação datada (tipo + criticidade) vira uma
  linha em `historico_riscos`; a `criticidade_atual` do cadastro é derivada da
  avaliação mais recente e alimenta os filtros do mapa.
- **Idempotência offline**: todo registro carrega um `client_uuid` (gerado no
  tablet), chave natural do upsert no sync.

## Como rodar (desenvolvimento)

Pré-requisitos: PHP 8.3+, Composer, **PostgreSQL com PostGIS**, Node 18+.

```bash
cd sisdc
composer install
cp .env.example .env
php artisan key:generate

# 1) Banco PostgreSQL + PostGIS
sudo -u postgres psql -c "CREATE ROLE sisdc LOGIN PASSWORD 'secret';"
sudo -u postgres psql -c "CREATE DATABASE sisdc OWNER sisdc;"
sudo -u postgres psql -d sisdc -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 2) Schema + dados iniciais (usuários e programas sociais)
php artisan migrate --seed

# 3) Servir
php artisan serve            # painel em http://localhost:8000
npm install && npm run dev   # (opcional) assets do PWA via Vite
```

> A migration `enable_postgis_extension` executa `CREATE EXTENSION IF NOT EXISTS postgis`.
> Em produção o DBA normalmente cria a extensão uma vez (precisa de privilégio).

### Usuários semeados (desenvolvimento)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@morretes.pr.gov.br` | `senha-segura` |
| Auditor | `auditor@morretes.pr.gov.br` | `senha-segura` |
| Operador | `operador@morretes.pr.gov.br` | `senha-segura` |

Acesse `http://localhost:8000/login` para entrar no painel (`/painel/mapa`).

## Endpoints principais

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/api/v1/sync/cadastros` | operador, admin | Push do lote offline (207 Multi-Status) |
| GET | `/api/v1/sync/cadastros?desde=` | operador, admin | Pull incremental (reconciliação) |
| GET | `/api/v1/mapa/cadastros.geojson` | autenticado | GeoJSON p/ Leaflet (filtros criticidade/área/bbox) |
| GET | `/painel/mapa` | autenticado | Mapa interativo de risco |

Tablets (PWA) autenticam a API por **Bearer token** (Sanctum); o painel usa a
sessão do navegador (`statefulApi`).

## RBAC

- **Administrador** — acesso total, gestão de usuários.
- **Auditor** — valida/rejeita cadastros sincronizados, vê relatórios.
- **Operador** — equipe de campo, origem do sync offline.

Aplicado via middleware `role:` (ex.: `->middleware('role:administrador,operador')`).

## Testes

```bash
# Crie o banco de teste com PostGIS (uma vez):
sudo -u postgres psql -c "CREATE DATABASE sisdc_test OWNER sisdc;"
sudo -u postgres psql -d sisdc_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"

php artisan test
```

`phpunit.xml` já aponta para a conexão `pgsql` (banco `sisdc_test`). Cobertura
em `tests/Feature/SyncCadastroTest.php`: idempotência do sync, derivação de
criticidade e bloqueio de RBAC.

Veja **[ARCHITECTURE.md](ARCHITECTURE.md)** para o detalhamento do fluxo
offline-first, sincronização e camadas do mapa.
