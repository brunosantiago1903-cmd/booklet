# Arquitetura — SISDC Morretes

Documento de arquitetura do sistema de Defesa Civil. Cobre (1) modelo de dados,
(2) sincronização offline-first e (3) painel/mapa.

---

## 1. Modelo de dados e geolocalização

### 1.1 Tabela `cadastros` (ocorrência/domicílio)

É a entidade raiz. Além dos campos de identificação da família e endereço,
carrega:

- `client_uuid` — UUID gerado no tablet; **chave de idempotência** do sync.
- `latitude` / `longitude` — coordenadas brutas coletadas (GPS do dispositivo).
- `localizacao GEOGRAPHY(POINT, 4326)` — coluna PostGIS com **índice GIST**,
  usada nas consultas espaciais (`ST_DWithin`, `ST_Intersects`, `ST_Distance`).
- `criticidade_atual` — denormalização da última avaliação de risco; acelera o
  filtro do mapa sem `JOIN` por marcador.
- `status` — máquina de estados do fluxo: `rascunho → sincronizado → validado`
  (ou `rejeitado`).

> **Por que duas representações de coordenada?** A `geography` é a fonte de
> verdade para análise espacial; `latitude`/`longitude` numéricas trafegam no
> JSON offline (o IndexedDB não fala PostGIS) e servem para exibição imediata.
> O `CadastroSyncService` mantém as duas consistentes via `ST_MakePoint`.

### 1.2 `habitantes` (1:N)

Tabela relacional (não JSON) porque pessoas são **consultadas individualmente**:
ex.: localizar moradores com necessidades especiais ou tipo sanguíneo X dentro
de um raio de risco. Cada habitante tem `client_uuid` próprio para o upsert.

### 1.3 `historico_riscos` (1:N) — linha do tempo de risco

Cada linha é uma avaliação **datada** (`avaliado_em`) com `tipo_evento`
(deslizamento, inundação, …) e `criticidade` (sem_risco → muito_alto). Tem
ponto espacial próprio (o local do deslizamento pode diferir da casa). É a base
para:

- reconstruir a evolução do risco de um domicílio;
- derivar `cadastros.criticidade_atual` (avaliação mais recente);
- camadas temporais e filtros do mapa.

### 1.4 Blocos 1:1 e N:N

`vulnerabilidade_saude`, `infraestruturas`, `riscos_ambientais` e `agriculturas`
são 1:1 com o cadastro (mapeiam as seções do formulário). `programas_sociais` é
N:N. Fotos são `anexos` polimórficos.

---

## 2. Sincronização Offline-First

### 2.1 Fluxo no tablet (PWA)

```
Formulário Wizard (passo a passo)
        │  a cada passo concluído
        ▼
IndexedDB: store "cadastros" (documento aninhado) + "outbox" (fila)
        │  evento `online` / Background Sync / botão "Sincronizar"
        ▼
POST /api/v1/sync/cadastros  (lote de até 200 cadastros)
        ▼
207 Multi-Status  →  confirma item a item, esvazia a outbox
        ▼
GET  /api/v1/sync/cadastros?desde=  (pull: status de auditoria)
```

O documento salvo no IndexedDB é **desnormalizado por cadastro** — habitantes,
histórico de risco e blocos 1:1 ficam aninhados no mesmo objeto. Isso permite:
preencher o Wizard 100% offline, persistir rascunho a cada passo (resiliência a
queda de bateria) e enviar tudo num único item de lote.

### 2.2 Contrato do endpoint de push

`POST /api/v1/sync/cadastros` — corpo:

```jsonc
{
  "batch_uuid": "uuid-do-lote",
  "device_id": "tablet-defesa-01",
  "cadastros": [
    {
      "client_uuid": "uuid-do-cadastro",      // idempotência
      "updated_at_client": "2026-05-31T12:00:00Z", // relógio do cliente (LWW)
      "nome_familia": "Família Silva",
      "latitude": -25.4767, "longitude": -48.8344,
      "areas_atencao": ["deslizamento", "inundacao"],
      "habitantes": [ { "client_uuid": "...", "nome_completo": "..." } ],
      "historico_riscos": [
        { "client_uuid": "...", "tipo_evento": "deslizamento",
          "criticidade": "alto", "avaliado_em": "2026-05-31T12:00:00Z" }
      ],
      "vulnerabilidade_saude": { ... },
      "infraestrutura": { ... },
      "risco_ambiental": { ... },
      "agricultura": { ... }
    }
  ]
}
```

Resposta `207 Multi-Status`:

```jsonc
{
  "batch_uuid": "...",
  "resumo": { "criados": 3, "atualizados": 1, "ignorados": 1, "erros": 0 },
  "itens": [
    { "client_uuid": "...", "acao": "criado", "id": 42, "criticidade_atual": "alto" },
    { "client_uuid": "...", "acao": "ignorado", "motivo": "cadastro_ja_validado" }
  ]
}
```

### 2.3 Garantias do servidor (`CadastroSyncService`)

1. **Idempotência** — `updateOrCreate` por `client_uuid`. Reenvios por rede
   instável nunca duplicam.
2. **Last-Write-Wins** — se o servidor tem `updated_at` mais novo que
   `updated_at_client`, o item é **ignorado** (não regride dados).
3. **Proteção de auditoria** — cadastros já `validado` não são sobrescritos por
   um reenvio de campo.
4. **Atomicidade por item** — cada cadastro + filhos sobe em uma transação; o
   erro de um item não derruba o lote. O resultado por item volta no 207.
5. **Auditabilidade** — cada lote gera um `sync_logs` com contadores e resultado.
6. **Derivação de criticidade** — após gravar o histórico, recalcula
   `criticidade_atual`.

### 2.4 Pull / reconciliação

`GET /api/v1/sync/cadastros?desde=ISO8601` devolve cadastros alterados (ex.: o
auditor marcou `validado`/`rejeitado` com `motivo_rejeicao`). O tablet atualiza
o status local e, se rejeitado, reabre o item para correção em campo.

### 2.5 Fotos (anexos)

Capturadas como `Blob` no store `anexos` do IndexedDB. Sobem **após** o cadastro
sincronizar (upload multipart referenciando o `client_uuid`), evitando payloads
JSON gigantes e permitindo retomada parcial.

---

## 3. Painel administrativo e mapa

### 3.1 GeoJSON sob demanda

`GET /api/v1/mapa/cadastros.geojson` retorna apenas cadastros `validado`,
filtrável por:

- `criticidade[]` — uma ou várias faixas;
- `area_atencao` — `whereJsonContains` na coluna `areas_atencao`;
- `bbox` — recorte por viewport via `ST_Intersects` + `ST_MakeEnvelope`
  (só carrega o que está na tela → escala para milhares de pontos).

Latitude/longitude são extraídas com `ST_Y/ST_X` direto da `geography`.

### 3.2 Camadas no Leaflet

O front cria um `L.layerGroup` **por nível de criticidade**. Os checkboxes do
cabeçalho ligam/desligam cada camada e refazem a consulta com os filtros ativos
no `moveend` do mapa. As cores dos marcadores vêm de `Criticidade::color()`
(fonte única de verdade compartilhada entre back e front).

### 3.3 Segurança

Tudo atrás de `auth` (web) / `auth:sanctum` (API). O push de campo exige perfil
`operador`/`administrador`; a validação exige `auditor`/`administrador`. Em
produção, o servidor interno é exposto somente via Cloudflare Tunnel.
