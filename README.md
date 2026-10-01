# Finanças do casal

App de finanças pessoais para duas pessoas, instalável no celular (PWA). Reúne conta corrente e cartões de crédito, lê comprovantes com IA e importa lançamentos do banco automaticamente pelo Open Finance (Meu Pluggy) ou por arquivos OFX.

## O que faz

- **Contas e cartões**: saldo das contas, faturas por mês (fechamento e vencimento), limite usado, pagamento de fatura como transferência (não conta como gasto duas vezes).
- **Lançamentos**: despesa, receita, estorno e transferência; compras parceladas no cartão (cada parcela cai na fatura certa; a diferença de centavos vai na 1ª parcela).
- **Comprovantes com IA**: foto, print ou PDF de Pix, boleto, cupom ou nota. O Claude lê valor, data, estabelecimento, forma de pagamento, parcelas e sugere a categoria; você só confere e confirma. No Android, dá para compartilhar o comprovante direto do app do banco para o Finanças.
- **Open Finance (Meu Pluggy)**: sincronização diária automática (07h) de contas e cartões; pendentes viram compensados sem duplicar; comprovantes enviados antes são vinculados ao lançamento do banco.
- **Importação OFX**: alternativa sem Pluggy; reimportar o mesmo arquivo não duplica nada.
- **Categorização automática**: regras do casal ("uber" → Transporte) + sugestões da IA para o resto.
- **Orçamento mensal por categoria** e painel com receitas, despesas, resultado do mês e gastos por categoria.
- **Casal**: as duas pessoas veem e editam tudo; cada lançamento registra quem lançou.

## Tecnologia

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Supabase (Postgres com RLS, Auth, Storage) · Claude (`claude-opus-5-5`) via `@anthropic-ai/sdk` · Pluggy (`pluggy-sdk`) · Vitest · hospedagem na Vercel com cron diário.

```
src/app/(app)/        telas logadas (painel, lançamentos, comprovantes, contas, categorias, mais)
src/app/api/cron/     sincronização diária (Vercel Cron)
src/lib/              regras de negócio puras e testadas (valores, faturas, parcelas, OFX, conciliação…)
src/lib/server/       importação, sincronização Pluggy, regras e categorização (só servidor)
src/lib/ai/           leitura de comprovantes e categorização com Claude
supabase/migrations/  esquema do banco, RLS e bucket de comprovantes
supabase/tests/       testes SQL (isolamento entre casais, saldos, faturas)
e2e/                  teste de ponta a ponta com Supabase local (GoTrue + PostgREST)
```

### Regras de dinheiro e datas

- Valores em **centavos inteiros** (`bigint`); nunca ponto flutuante.
- `amount_cents` tem sinal: negativo = saiu da conta (ou aumentou a dívida do cartão).
- Datas de lançamento são `date` (sem fuso); "hoje" é calculado em `America/Sao_Paulo`.
- Fatura (`invoice_month`) = 1º dia do mês de **vencimento**. Compra no dia do fechamento já vai para a fatura seguinte.
- Transferências (incluindo pagamento de fatura) ficam fora de receitas/despesas.

## Implantação

### Jeito rápido: um comando (recomendado)

No seu computador, com Node.js 22 e o repositório clonado:

```bash
npm install
npm run deploy
```

O script `scripts/deploy.mjs` faz tudo isto:
- cria o projeto Supabase (São Paulo);
- aplica o banco, desliga o cadastro público e cria os dois usuários;
- gera os segredos;
- configura todas as variáveis na Vercel e publica;
- grava o `.env.local` para desenvolvimento.

Ele vai pedir:
- o **token de acesso da Supabase** (supabase.com/dashboard/account/tokens);
- o **login na Vercel** (pelo navegador; ou defina `VERCEL_TOKEN`);
- os **e-mails e senhas** de vocês dois;
- a **chave da Anthropic** (opcional; também aceita `ANTHROPIC_API_KEY` no ambiente).

Para ver tudo o que ele faria, sem executar nada:

```bash
npm run deploy -- --dry-run
```

A senha do banco fica em `.env.deploy`. Não versione esse arquivo.

### Jeito manual

Tempo estimado: 30–40 minutos. Você precisa de contas na Supabase, na Vercel e na Anthropic. A Pluggy é opcional, para a sincronização automática com o banco.

#### 1. Supabase (banco, login e arquivos)

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo, se disponível).
2. Aplique o esquema. Escolha uma das opções:
   - **SQL Editor**: cole o conteúdo de `supabase/migrations/20261001000000_init.sql` e execute.
   - **CLI**: `npx supabase login`, `npx supabase link --project-ref SEU_REF` e depois `npx supabase db push`.
3. Em **Authentication**, desligue o cadastro público ("Allow new users to sign up"). Os dois usuários são criados no passo 4.
4. Em **Project Settings → API Keys**, copie:
   - a URL do projeto;
   - a **Publishable key**;
   - a **Secret key**, que é só do servidor (nunca exponha no navegador).
5. Crie os dois usuários. Com o `.env.local` preenchido (veja abaixo), rode:
   ```bash
   npm run create-user -- voce@exemplo.com "senha-com-10-ou-mais"
   npm run create-user -- esposa@exemplo.com "outra-senha-forte"
   ```
   Alternativa: no painel, **Authentication → Users → Add user**, marcando "Auto Confirm User".

#### 2. Anthropic (leitura de comprovantes e categorização)

Crie uma chave em [console.anthropic.com](https://console.anthropic.com). A cobrança é por uso, separada da assinatura do claude.ai.

Sem a chave o app funciona, mas os comprovantes ficam para preencher à mão e não há categorização por IA.

#### 3. Segredos do app

```bash
# APP_ENCRYPTION_KEY: criptografa o Client Secret da Pluggy no banco
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# CRON_SECRET: protege a rota de sincronização diária
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

#### 4. Vercel (hospedagem)

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório (framework: Next.js).
2. Cadastre as variáveis de ambiente (modelo em `.env.example`):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `ALLOWED_EMAILS` | os dois e-mails, separados por vírgula |
   | `ANTHROPIC_API_KEY` | chave da Anthropic |
   | `APP_ENCRYPTION_KEY` | gerada no passo 3 |
   | `CRON_SECRET` | gerado no passo 3 |

3. Faça o deploy. O cron diário já vem configurado em `vercel.json` (10:00 UTC = 07:00 em Brasília). A Vercel envia `Authorization: Bearer CRON_SECRET` automaticamente.
4. A sincronização e a conexão com o banco usam até 300 s (`maxDuration`). Isso exige o **Fluid Compute**, padrão em projetos novos da Vercel. Se o deploy reclamar do limite, ative-o em **Settings → Functions**.
5. No Supabase, em **Authentication → URL Configuration**, coloque a URL da Vercel em "Site URL".

### Primeiro uso

1. Abra a URL no celular e entre com e-mail e senha. No primeiro acesso, o app cria a "casa" e as categorias padrão.
2. Instale o app:
   - **iPhone**: Safari → Compartilhar → "Adicionar à Tela de Início".
   - **Android**: Chrome → ⋮ → "Instalar app".
3. Cadastre as contas e os cartões, ou conecte o banco (seção abaixo).

### Open Finance pelo Meu Pluggy (opcional)

Cada pessoa conecta o próprio CPF:

1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai), um time e uma aplicação. Anote o **Client ID** e o **Client Secret**.
2. **Durante o período de teste da Pluggy**, entre em [meu.pluggy.ai](https://meu.pluggy.ai) e conecte seus bancos e cartões pelo Open Finance.
3. Conecte o item do Meu Pluggy na aplicação e copie o **Item ID**.
4. No app, abra **Mais → Open Finance**, cole os dados e toque em "Conectar e importar". As contas e os cartões são criados sozinhos, com 12 meses de histórico.

Pelo que a própria Pluggy divulga, o Meu Pluggy é gratuito para uso pessoal (um CPF por conta). Confira as condições atuais no site deles. Se o programa mudar, a importação OFX (**Mais → Importar extrato OFX**) continua funcionando.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
```

Verificações:

```bash
npm run lint
npm run typecheck
npm test                     # regras de negócio (Vitest)
npm run test:db              # migrations + RLS num Postgres local (veja scripts/test-db.sh)
```

O teste de ponta a ponta (`e2e/README.md`) sobe GoTrue + PostgREST + um Storage simulado contra um Postgres local e percorre o app no navegador: login, contas, cartão parcelado, pagamento de fatura, orçamento, OFX, comprovante, segundo membro do casal, usuário barrado e tema escuro.

## Segurança e privacidade

- **RLS em todas as tabelas**: cada casal só enxerga os próprios dados. FKs compostas impedem apontar para dados de outro casal. Coberto por `supabase/tests/database.test.sql`.
- **Login**: só por usuários criados pelo administrador e presentes em `ALLOWED_EMAILS`.
- **Client Secret da Pluggy**: criptografado com AES-256-GCM. A coluna não é legível pelo navegador.
- **Comprovantes**: ficam em um bucket privado, com acesso só por link temporário. Na leitura, o arquivo é enviado à API da Anthropic.
- **Chave secreta do Supabase e chave da Anthropic**: existem apenas no servidor.

## Custos (estimativa)

- **Supabase e Vercel**: os planos gratuitos atendem dois usuários. Confira os limites atuais de cada um.
- **Claude**: cerca de US$ 0,02 a 0,05 por comprovante (modelo `claude-opus-5-5`, esforço baixo). A categorização em lote custa centavos por centena de lançamentos.
- **Meu Pluggy**: gratuito para uso pessoal, segundo a Pluggy.

## Limitações conhecidas

- O iPhone não oferece "Compartilhar para" em PWAs. Lá, o envio é pelo botão do app (câmera, fotos ou arquivos).
- A sincronização do Open Finance é diária. Gastos recentes podem levar até um dia para aparecer; o comprovante cobre o "na hora".
- Um lançamento do banco excluído no app volta na próxima sincronização. Prefira recategorizar ou marcar como transferência.
- Sem a chave da Anthropic, não há leitura automática nem categorização por IA.
