<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Convenções do projeto

- Valores em centavos inteiros com sinal (`amount_cents < 0` = saída). Datas são `YYYY-MM-DD` sem fuso; "hoje" vem de `todayISO()` (America/Sao_Paulo).
- Regras de negócio ficam em `src/lib/*.ts` como funções puras com testes (`npm test`). Código que toca banco/APIs fica em `src/lib/server` e `src/lib/ai`.
- Toda tabela nova precisa de `household_id`, RLS e FK composta `(id, household_id)`; cubra em `supabase/tests/database.test.sql` (`npm run test:db`).
- Mudou o esquema? Atualize `src/lib/database.types.ts`.
- Antes de concluir: `npm run lint && npm run typecheck && npm test && npm run test:db`; para fluxos de tela, `e2e/` (veja e2e/README.md).
