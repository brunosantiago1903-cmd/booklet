# Sistema de Gestão de Ativos de TI e Telemetria Municipal

Sistema completo de inventário físico e monitorização de telemetria das estações
de trabalho, conforme a especificação técnica do projeto. Sem frameworks e sem
dependências externas: **PHP puro + SQLite** — roda em qualquer servidor com PHP 8+.

## Componentes

| Pasta | Componente | Descrição |
|---|---|---|
| `api/` | **API REST** | Backend em PHP puro: autenticação JWT, telemetria, inventário, usuários, CSV |
| `pwa/` | **PWA Mobile** | App de campo para técnicos: fila de pendentes, câmara, GPS |
| `dashboard/` | **Dashboard Web** | Painel admin: semáforo, mapa interativo, histórico, usuários, exportação |
| `agente/` | **Agente Windows** | `coleta.ps1` + `install.bat` (tarefa agendada a cada 5 min) |

## Produção com Docker (recomendado)

```bash
cd sistema-inventario

# 1. Configurar segredos e administrador inicial
cp .env.example .env
nano .env        # JWT_SECRET, AGENT_KEY, ADMIN_EMAIL, ADMIN_SENHA

# 2. Subir o sistema (o admin é criado automaticamente na primeira subida)
docker compose up -d --build
```

- **Dashboard (admin):** http://localhost:8080/dashboard/
- **PWA (técnicos):** http://localhost:8080/pwa/
- **API:** http://localhost:8080/api/...

O banco de dados e as fotos ficam em volumes Docker (`dados` e `uploads`) —
sobrevivem a restarts, rebuilds e atualizações do container. Para backup:
`docker run --rm -v sistema-inventario_dados:/d -v $(pwd):/backup alpine tar czf /backup/dados.tar.gz /d`

### Exposição segura na internet (Cloudflare Tunnel, no próprio compose)

Conforme a especificação, **não abra portas no firewall**. Crie um túnel no
painel Cloudflare Zero Trust (Networks → Tunnels), aponte-o para
`http://app:80`, cole o token no `.env` (`CLOUDFLARE_TUNNEL_TOKEN`) e suba com:

```bash
docker compose --profile tunnel up -d
```

O serviço `cloudflared` sobe junto com a aplicação e o Cloudflare emite o
certificado SSL automaticamente no domínio da autarquia.

## Alternativas sem Docker

### Servidor embutido do PHP (desenvolvimento/testes)

```bash
php api/seed_admin.php admin@prefeitura.gov.br SuaSenhaForte "Administrador"
php -S 0.0.0.0:8000 router.php
# Dashboard: http://localhost:8000/dashboard/  ·  PWA: http://localhost:8000/pwa/
```

### XAMPP / Apache

Copie a pasta `sistema-inventario/` para o `htdocs/` (ou aponte o DocumentRoot
para ela). O `api/.htaccess` já encaminha as rotas para o front controller —
é necessário `AllowOverride All` no diretório. Edite `JWT_SECRET` e `AGENT_KEY`
diretamente em `api/config.php`.

> ⚠️ **HTTPS é obrigatório no campo:** os navegadores móveis bloqueiam a
> **câmara** e o **GPS** em ligações inseguras (exceto `localhost`). O PWA só
> funciona plenamente através do túnel HTTPS.

## Instalação do agente nas estações (pen drive)

1. Edite `agente/install.bat` e configure `API_URL` (e `AGENT_KEY`, se usar).
2. Copie a pasta `agente/` para a pen drive.
3. Na estação, execute `install.bat` **como Administrador**.
4. O script cria a tarefa agendada (a cada 5 min) e faz o primeiro disparo —
   a máquina entra como **PENDENTE** na fila do PWA.

## Fluxo de trabalho de campo

1. Técnico instala o agente na estação (pen drive → `install.bat`).
2. A API recebe o MAC e insere a máquina como `PENDENTE`.
3. No PWA, o técnico vê a máquina na fila, fotografa a etiqueta de património,
   preenche os periféricos e submete — o GPS é anexado automaticamente.
4. Status muda para `CONCLUIDO`; a estação aparece no mapa e no painel.
5. O admin pode dar **baixa por obsolescência** (`BAIXA`) no dashboard.

## Painel semafórico

| Cor | Critério |
|---|---|
| 🟢 Verde | Funcionamento normal |
| 🟡 Amarelo | Disco > 85% **ou** RAM > 90% |
| 🔴 Vermelho | Offline (sem telemetria há mais de 15 min) |
| ⚪ Cinza | Baixa por obsolescência |

Limiares ajustáveis em `api/config.php` (`LIMIAR_DISCO`, `LIMIAR_RAM`, `OFFLINE_MINUTOS`).

## Endpoints da API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/login` | público | Login → token JWT (validade 8h) |
| POST | `/api/telemetria` | agente¹ | Recebe métricas; auto-insere estação PENDENTE |
| GET | `/api/estacoes` | admin | Lista completa com última telemetria + semáforo |
| GET | `/api/estacoes/pendentes` | admin/operador | Fila de máquinas pendentes (PWA) |
| GET | `/api/estacoes/{mac}/historico?horas=24` | admin | Histórico de telemetria |
| PATCH | `/api/estacoes/{mac}/status` | admin | Alteração manual (PENDENTE/CONCLUIDO/BAIXA) |
| POST | `/api/inventario` | admin/operador | Vistoria: campos + foto + GPS (multipart) |
| GET/POST/PATCH/DELETE | `/api/usuarios[/{id}]` | admin | Gestão de utilizadores |
| GET | `/api/export/csv` | admin | Relatório unificado para auditoria |
| GET | `/api/uploads/{arquivo}` | público² | Fotos das vistorias |

¹ Se `AGENT_KEY` for definida em `config.php`, o agente deve enviar o header `X-Agent-Key`.
² Nomes de arquivo aleatórios (16 hex) — impossíveis de adivinhar.

## Segurança — checklist antes do deploy

- [ ] **Trocar `JWT_SECRET`** no `.env` (Docker) ou em `api/config.php` — ex.: `openssl rand -hex 32`.
- [ ] Definir `AGENT_KEY` no `.env` e no `install.bat` (protege o endpoint de telemetria).
- [ ] Usar HTTPS via Cloudflare Tunnel (obrigatório para câmara/GPS).
- [ ] Senhas armazenadas com `password_hash` (bcrypt); acesso direto ao banco bloqueado
      (config do Apache na imagem Docker + `.htaccess` no caso XAMPP).

## Notas técnicas

- Timestamps armazenados em **UTC** (`datetime('now')` do SQLite).
- SQLite em modo WAL: suporta centenas de agentes reportando a cada 5 min.
  Para milhares de estações, migrar para MySQL (queries portáveis via PDO).
- O MAC é a chave primária: estações com Wi-Fi + cabo podem gerar registos
  duplicados; o agente sempre usa o primeiro adaptador de rede ativo.
- CPU% é amostra instantânea (`Win32_Processor.LoadPercentage`) — adequado
  para tendências no dashboard.
