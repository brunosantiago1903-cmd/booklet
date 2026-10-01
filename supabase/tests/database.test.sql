-- Testes do esquema: isolamento por household (RLS), FKs compostas, views e funções.
-- Executado por scripts/test-db.sh após aplicar o stub e as migrations.

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FALHOU: %', msg;
  end if;
  raise notice 'ok - %', msg;
end;
$$;

-- Executa SQL esperando erro com um SQLSTATE específico.
create function pg_temp.fails(sql text, expected_state text, msg text) returns void
language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'ok - %', msg;
      return;
    end if;
    raise exception 'FALHOU: % (SQLSTATE % em vez de %: %)', msg, sqlstate, expected_state, sqlerrm;
  end;
  raise exception 'FALHOU: % (não gerou erro)', msg;
end;
$$;

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuários: A e B formam o casal; C pertence a outro household (intruso)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carlos@exemplo.com');

select pg_temp.ok(
  public.bootstrap_member('00000000-0000-0000-0000-00000000000a', 'Ana@Exemplo.com', 'Ana') is not null,
  'bootstrap cria household para o primeiro membro');
select pg_temp.ok(
  public.bootstrap_member('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com', 'Bia')
    = (select household_id from public.members where user_id = '00000000-0000-0000-0000-00000000000a'),
  'segundo membro entra no mesmo household');
select pg_temp.ok(
  public.bootstrap_member('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', 'Ana')
    = (select household_id from public.members where user_id = '00000000-0000-0000-0000-00000000000a'),
  'bootstrap é idempotente');
select pg_temp.ok((select count(*) from public.members) = 2, 'sem membros duplicados');
select pg_temp.ok((select email from public.members where display_name = 'Ana') = 'ana@exemplo.com',
  'e-mail normalizado em minúsculas');
select pg_temp.ok((select count(*) from public.categories where parent_id is null) = 18,
  'categorias principais semeadas');
select pg_temp.ok((select count(*) from public.categories where parent_id is not null) > 30,
  'subcategorias semeadas');
select pg_temp.ok(
  not exists (
    select 1 from public.categories c join public.categories p on p.id = c.parent_id
    where c.kind <> p.kind),
  'subcategoria tem o mesmo tipo da categoria');

-- Segundo household (de outra pessoa), criado direto como superusuário.
insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000f2', 'Outra casa');
insert into public.members (household_id, user_id, email, display_name)
values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000c', 'carlos@exemplo.com', 'Carlos');

-- ---------------------------------------------------------------------------
-- Dados do intruso C
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into public.accounts (id, name, type, initial_balance_cents)
values ('00000000-0000-0000-0000-0000000000c1', 'Conta do Carlos', 'checking', 50000);
insert into storage.objects (bucket_id, name)
values ('receipts', '00000000-0000-0000-0000-0000000000f2/comprovante.jpg');
reset role;

-- ---------------------------------------------------------------------------
-- Usuário A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select pg_temp.ok(public.current_household_id() is not null, 'current_household_id resolve para A');
select pg_temp.ok((select count(*) from public.households) = 1, 'A vê só o próprio household');
select pg_temp.ok((select count(*) from public.members) = 2, 'A vê os dois membros do casal');

insert into public.accounts (id, name, type, initial_balance_cents)
values ('00000000-0000-0000-0000-0000000000a1', 'Conta corrente', 'checking', 100000);
insert into public.accounts (id, name, type, closing_day, due_day, credit_limit_cents)
values ('00000000-0000-0000-0000-0000000000a2', 'Cartão', 'credit_card', 3, 10, 500000);

select pg_temp.ok((select count(*) from public.accounts) = 2, 'A não vê contas do intruso');
select pg_temp.ok(
  (select household_id from public.accounts where id = '00000000-0000-0000-0000-0000000000a1')
    = public.current_household_id(),
  'household_id preenchido por padrão');

select pg_temp.fails(
  $sql$insert into public.accounts (name, type, household_id)
       values ('Invasão', 'checking', '00000000-0000-0000-0000-0000000000f2')$sql$,
  '42501', 'A não cria conta em outro household');

select pg_temp.fails(
  $sql$insert into public.transactions (account_id, type, amount_cents, date, description)
       values ('00000000-0000-0000-0000-0000000000c1', 'expense', -100, '2026-01-01', 'x')$sql$,
  '23503', 'A não lança na conta do intruso (FK composta)');

select pg_temp.fails(
  $sql$insert into public.accounts (name, type) values ('Cartão sem dias', 'credit_card')$sql$,
  '23514', 'cartão exige dia de fechamento e vencimento');

-- Lançamentos de A
insert into public.transactions (account_id, type, amount_cents, date, description, category_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'income', 500000, '2026-09-05', 'Salário',
    (select id from public.categories where name = 'Salário')),
  ('00000000-0000-0000-0000-0000000000a1', 'expense', -12345, '2026-09-06', 'Mercado',
    (select id from public.categories where name = 'Mercado')),
  ('00000000-0000-0000-0000-0000000000a2', 'expense', -30000, '2026-09-10', 'Compra no cartão', null);

update public.transactions set invoice_month = '2026-10-01'
where account_id = '00000000-0000-0000-0000-0000000000a2';

-- Pagamento da fatura: transferência conta -> cartão
insert into public.transactions (account_id, type, amount_cents, date, description, transfer_group_id, invoice_month)
values
  ('00000000-0000-0000-0000-0000000000a1', 'transfer', -30000, '2026-10-09', 'Pagamento fatura',
    '00000000-0000-0000-0000-0000000000d1', null),
  ('00000000-0000-0000-0000-0000000000a2', 'transfer', 30000, '2026-10-09', 'Pagamento fatura',
    '00000000-0000-0000-0000-0000000000d1', '2026-10-01');

select pg_temp.ok(
  (select balance_cents from public.account_balances where account_id = '00000000-0000-0000-0000-0000000000a1')
    = 100000 + 500000 - 12345 - 30000,
  'saldo da conta = inicial + lançamentos');
select pg_temp.ok(
  (select balance_cents from public.account_balances where account_id = '00000000-0000-0000-0000-0000000000a2') = 0,
  'cartão zerado após pagar a fatura');
select pg_temp.ok((select count(*) from public.account_balances) = 2, 'view de saldos respeita RLS');
select pg_temp.ok(
  (select charges_cents = 30000 and payments_cents = 30000 and transaction_count = 1
   from public.card_invoices
   where account_id = '00000000-0000-0000-0000-0000000000a2' and invoice_month = '2026-10-01'),
  'fatura soma compras e pagamentos separadamente');

select pg_temp.fails(
  $sql$insert into public.transactions (account_id, type, amount_cents, date, description, category_id)
       values ('00000000-0000-0000-0000-0000000000a1', 'transfer', -1, '2026-09-01', 'x',
               (select id from public.categories where name = 'Mercado'))$sql$,
  '23514', 'transferência não tem categoria');
select pg_temp.fails(
  $sql$insert into public.transactions (account_id, type, amount_cents, date, description, invoice_month)
       values ('00000000-0000-0000-0000-0000000000a2', 'expense', -1, '2026-09-01', 'x', '2026-10-15')$sql$,
  '23514', 'mês da fatura precisa ser o dia 1');
select pg_temp.fails(
  $sql$insert into public.transactions (account_id, type, amount_cents, date, description)
       values ('00000000-0000-0000-0000-0000000000a1', 'expense', 0, '2026-09-01', 'x')$sql$,
  '23514', 'valor zero é rejeitado');

-- updated_at é atualizado no UPDATE
update public.transactions set notes = 'nota' where description = 'Mercado';
select pg_temp.ok(
  (select updated_at > created_at from public.transactions where description = 'Mercado'),
  'trigger de updated_at');

-- Segredo da Pluggy não é legível
insert into public.bank_connections (label, client_id, client_secret_encrypted, item_id)
values ('Meu Pluggy da Ana', 'client-id', 'cifrado', 'item-1');
select pg_temp.ok((select count(*) from public.bank_connections where label = 'Meu Pluggy da Ana') = 1,
  'A lê colunas públicas da conexão');
select pg_temp.fails(
  $sql$select client_secret_encrypted from public.bank_connections$sql$,
  '42501', 'A não lê o segredo da Pluggy');

-- Membros: só altera o próprio nome
update public.members set display_name = 'Bia hackeada' where display_name = 'Bia';
select pg_temp.ok((select count(*) from public.members where display_name = 'Bia') = 1,
  'A não altera o nome da Bia');
update public.members set display_name = 'Ana Clara' where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select count(*) from public.members where display_name = 'Ana Clara') = 1,
  'A altera o próprio nome');

-- Storage
insert into storage.objects (bucket_id, name)
values ('receipts', (select public.current_household_id()::text || '/recibo.jpg'));
select pg_temp.ok((select count(*) from storage.objects) = 1, 'A vê só os comprovantes do casal');
select pg_temp.fails(
  $sql$insert into storage.objects (bucket_id, name)
       values ('receipts', '00000000-0000-0000-0000-0000000000f2/roubo.jpg')$sql$,
  '42501', 'A não grava na pasta de outro household');

-- Funções administrativas bloqueadas
select pg_temp.fails(
  $sql$select public.bootstrap_member('00000000-0000-0000-0000-00000000000c', 'x@x.com', 'X')$sql$,
  '42501', 'usuário não executa bootstrap_member');
select pg_temp.fails(
  $sql$select public.seed_default_categories(public.current_household_id())$sql$,
  '42501', 'usuário não executa seed_default_categories');

-- Apagar categoria limpa só category_id (FK composta com SET NULL de coluna)
delete from public.categories where name = 'Mercado';
select pg_temp.ok(
  (select category_id is null and household_id is not null
   from public.transactions where description = 'Mercado'),
  'apagar categoria mantém o lançamento sem categoria');

reset role;

-- ---------------------------------------------------------------------------
-- Usuário B (mesmo casal) enxerga os dados de A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.accounts) = 2, 'B vê as contas do casal');
select pg_temp.ok((select count(*) from public.transactions) = 5, 'B vê os lançamentos do casal');
reset role;

-- ---------------------------------------------------------------------------
-- Intruso C não vê nada do casal
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.accounts) = 1, 'C vê só a própria conta');
select pg_temp.ok((select count(*) from public.transactions) = 0, 'C não vê lançamentos do casal');
select pg_temp.ok((select count(*) from public.categories) = 0, 'C não vê categorias do casal');
select pg_temp.ok((select count(*) from storage.objects) = 1, 'C vê só o próprio comprovante');
select pg_temp.ok((select count(*) from public.card_invoices) = 0, 'C não vê faturas do casal');
reset role;

-- ---------------------------------------------------------------------------
-- Usuário sem membership não vê nada
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000ee');
select pg_temp.ok(public.current_household_id() is null, 'sem membership não há household');
select pg_temp.ok((select count(*) from public.accounts) = 0, 'sem membership não vê contas');
select pg_temp.fails(
  $sql$insert into public.accounts (name, type) values ('x', 'checking')$sql$,
  '42501', 'sem membership não cria conta');
reset role;
