# Teste de ponta a ponta

Roda o app de verdade no navegador contra um "Supabase" local mínimo:

- **Postgres** (o seu, local);
- **GoTrue** (autenticação);
- **PostgREST** (API);
- **gateway** em `:54321` com as mesmas rotas do Supabase (`/auth/v1`, `/rest/v1`, `/storage/v1`). O Storage é simulado e aplica as policies de `storage.objects` do Postgres.

```bash
DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres bash e2e/start.sh
npm run build && npm start        # em outro terminal (usa o .env.local gerado)
node e2e/run.mjs                  # CHROMIUM_PATH=/caminho/do/chrome se preferir
bash e2e/stop.sh
```

O `start.sh` baixa o PostgREST e o GoTrue na primeira vez (para `e2e/.cache`), recria o banco `financas_e2e`, aplica as migrations, **sobrescreve o `.env.local`** e cria três usuários:
- ana@teste.com e bruno@teste.com: o casal autorizado;
- intruso@teste.com: fora de `ALLOWED_EMAILS`.

Cenários cobertos:
- login (senha errada e certa);
- conta e cartão;
- despesa com regra de categoria;
- compra parcelada em 3x;
- receita e pagamento de fatura;
- totais do painel e orçamento estourado;
- importação OFX (vincula sem duplicar, reimportação idempotente, regra aplicada);
- comprovante (upload, link assinado, confirmação);
- edição de lançamento importado;
- segundo membro do casal e usuário barrado;
- tema escuro, cron autenticado e console do navegador sem erros.

Capturas de tela ficam em `e2e/.cache/shots`.

Não coberto: a leitura real pela API da Anthropic e a Pluggy, que exigem credenciais. Nesses fluxos, os testes unitários cobrem o mapeamento dos dados.
