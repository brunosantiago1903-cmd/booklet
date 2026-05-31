# SISDC — Sistema de Gestão de Defesa Civil de Morretes-PR

PWA **Offline-First** para levantamento de risco e vulnerabilidade socioambiental
em campo, com sincronização ao reconectar e painel administrativo com mapa de risco.

> Baseado no *Formulário para análise de riscos e vulnerabilidade socioambiental
> no município de Morretes – PR* (SISDC).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Laravel 11 · PHP 8.3 |
| Banco | PostgreSQL + **PostGIS** (`GEOGRAPHY(POINT, 4326)`) |
| Frontend painel | Blade · Livewire · TailwindCSS |
| PWA | Service Worker · IndexedDB (`idb`) · Background Sync |
| Mapa | Leaflet.js (GeoJSON) |
| Auth | Laravel Sanctum + RBAC (Administrador / Auditor / Operador) |
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
  também em colunas numéricas para exibição rápida e trânsito offline.
- **Histórico de risco**: cada avaliação datada (tipo + criticidade) vira uma
  linha em `historico_riscos`; a `criticidade_atual` do cadastro é derivada da
  avaliação mais recente e alimenta os filtros do mapa.
- **Idempotência offline**: todo registro carrega um `client_uuid` (gerado no
  tablet), chave natural do upsert no sync.

## Como rodar (desenvolvimento)

```bash
cd sisdc
composer install
cp .env.example .env
php artisan key:generate

# PostgreSQL + PostGIS
php artisan migrate --seed   # cria schema e popula programas sociais

php artisan serve
npm install && npm run dev   # assets do PWA
```

> A migration `enable_postgis_extension` executa `CREATE EXTENSION postgis`.
> O usuário do banco precisa de permissão (em produção, normalmente o DBA roda uma vez).

## Endpoints principais

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/api/v1/sync/cadastros` | operador, admin | Push do lote offline (207 Multi-Status) |
| GET | `/api/v1/sync/cadastros?desde=` | operador, admin | Pull incremental (reconciliação) |
| GET | `/api/v1/mapa/cadastros.geojson` | autenticado | GeoJSON p/ Leaflet (filtros de criticidade/bbox) |
| GET | `/painel/mapa` | autenticado | Mapa interativo de risco |

## RBAC

- **Administrador** — acesso total, gestão de usuários.
- **Auditor** — valida/rejeita cadastros sincronizados, vê relatórios.
- **Operador** — equipe de campo, origem do sync offline.

Aplicado via middleware `role:` (ex.: `->middleware('role:administrador,operador')`).

## Testes

```bash
php artisan test
```

Cobertura sugerida inclusa em `tests/Feature`: idempotência do sync,
derivação de criticidade e bloqueio de RBAC. Requer PostgreSQL+PostGIS de teste.

Veja **[ARCHITECTURE.md](ARCHITECTURE.md)** para o detalhamento do fluxo
offline-first, sincronização e camadas do mapa.
