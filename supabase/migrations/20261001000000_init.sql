-- Finanças do casal: esquema inicial.
--
-- Convenções:
-- * Valores em centavos (bigint). amount_cents é ASSINADO: negativo = dinheiro saindo
--   da conta (ou dívida aumentando no cartão); positivo = entrando.
-- * Datas de lançamento são `date` (sem fuso), para não deslocar o dia em America/Sao_Paulo.
-- * invoice_month = primeiro dia do mês de VENCIMENTO da fatura do cartão.
-- * Tudo pertence a um household (o casal). RLS isola por household; FKs compostas
--   (id, household_id) impedem apontar para linhas de outro household.

-- ============================================================================
-- Tipos
-- ============================================================================
create type public.account_type as enum ('checking', 'credit_card');
create type public.category_kind as enum ('income', 'expense');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.transaction_status as enum ('pending', 'cleared');
create type public.transaction_source as enum ('manual', 'receipt', 'open_finance', 'ofx');
create type public.category_source as enum ('user', 'rule', 'ai');
create type public.receipt_status as enum ('uploaded', 'extracted', 'failed', 'confirmed');

-- ============================================================================
-- Household e membros
-- ============================================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa casa' check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

-- SECURITY DEFINER evita recursão de RLS ao consultar members dentro das policies.
create function public.current_household_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.members m where m.user_id = auth.uid()
$$;

-- ============================================================================
-- Contas e cartões
-- ============================================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  owner_member_id uuid,
  name text not null check (length(trim(name)) > 0),
  type public.account_type not null,
  institution text,
  initial_balance_cents bigint not null default 0,
  credit_limit_cents bigint check (credit_limit_cents is null or credit_limit_cents >= 0),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (owner_member_id, household_id)
    references public.members (id, household_id) on delete set null (owner_member_id),
  constraint credit_card_requires_days
    check (type <> 'credit_card' or (closing_day is not null and due_day is not null))
);

-- ============================================================================
-- Categorias (2 níveis: categoria > subcategoria)
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  parent_id uuid,
  name text not null check (length(trim(name)) > 0),
  kind public.category_kind not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique nulls not distinct (household_id, parent_id, name),
  foreign key (parent_id, household_id)
    references public.categories (id, household_id) on delete cascade
);

-- ============================================================================
-- Comprovantes (arquivo no Storage + extração feita pela IA)
-- ============================================================================
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  uploaded_by uuid,
  storage_path text not null unique,
  mime_type text not null,
  file_name text,
  status public.receipt_status not null default 'uploaded',
  extraction jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (uploaded_by, household_id)
    references public.members (id, household_id) on delete set null (uploaded_by)
);

-- ============================================================================
-- Lançamentos
-- ============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  category_source public.category_source,
  type public.transaction_type not null,
  amount_cents bigint not null check (amount_cents <> 0),
  date date not null,
  invoice_month date check (invoice_month is null or extract(day from invoice_month) = 1),
  description text not null check (length(trim(description)) > 0),
  original_description text,
  notes text,
  status public.transaction_status not null default 'cleared',
  transfer_group_id uuid,
  installment_group_id uuid,
  installment_number smallint,
  installment_total smallint,
  source public.transaction_source not null default 'manual',
  external_id text,
  receipt_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, household_id)
    references public.accounts (id, household_id) on delete cascade,
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete set null (category_id),
  foreign key (receipt_id, household_id)
    references public.receipts (id, household_id) on delete set null (receipt_id),
  foreign key (created_by, household_id)
    references public.members (id, household_id) on delete set null (created_by),
  unique (account_id, external_id),
  constraint transfer_has_no_category check (type <> 'transfer' or category_id is null),
  constraint installment_pair
    check ((installment_number is null) = (installment_total is null)),
  constraint installment_range
    check (installment_number is null or installment_number between 1 and installment_total)
);

create index transactions_household_date_idx on public.transactions (household_id, date desc);
create index transactions_account_date_idx on public.transactions (account_id, date desc);
create index transactions_account_invoice_idx on public.transactions (account_id, invoice_month);
create index transactions_transfer_group_idx on public.transactions (transfer_group_id)
  where transfer_group_id is not null;
create index transactions_installment_group_idx on public.transactions (installment_group_id)
  where installment_group_id is not null;
create index transactions_receipt_idx on public.transactions (receipt_id)
  where receipt_id is not null;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ============================================================================
-- Regras de categorização e orçamento
-- ============================================================================
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  pattern text not null check (length(pattern) >= 2),
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (household_id, pattern),
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete cascade
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (household_id, category_id),
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete cascade
);

-- ============================================================================
-- Open Finance (Pluggy / Meu Pluggy)
-- ============================================================================
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  member_id uuid,
  provider text not null default 'pluggy' check (provider = 'pluggy'),
  label text not null check (length(trim(label)) > 0),
  client_id text not null,
  -- Criptografado no servidor (AES-256-GCM, APP_ENCRYPTION_KEY). Coluna sem SELECT para usuários.
  client_secret_encrypted text not null,
  item_id text not null,
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  unique (household_id, item_id),
  unique (id, household_id),
  foreign key (member_id, household_id)
    references public.members (id, household_id) on delete set null (member_id)
);

create table public.bank_account_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id()
    references public.households (id) on delete cascade,
  connection_id uuid not null,
  external_account_id text not null,
  external_name text not null,
  external_type text not null,
  external_subtype text,
  -- null = conta ignorada na sincronização
  account_id uuid,
  created_at timestamptz not null default now(),
  unique (connection_id, external_account_id),
  foreign key (connection_id, household_id)
    references public.bank_connections (id, household_id) on delete cascade,
  foreign key (account_id, household_id)
    references public.accounts (id, household_id) on delete set null (account_id)
);

-- ============================================================================
-- Views (security_invoker: aplicam o RLS de quem consulta)
-- ============================================================================
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.household_id,
  a.initial_balance_cents + coalesce(sum(t.amount_cents), 0)::bigint as balance_cents
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

create view public.card_invoices with (security_invoker = true) as
select
  t.household_id,
  t.account_id,
  t.invoice_month,
  coalesce(-sum(t.amount_cents) filter (where t.type <> 'transfer'), 0)::bigint as charges_cents,
  coalesce(sum(t.amount_cents) filter (where t.type = 'transfer'), 0)::bigint as payments_cents,
  count(*) filter (where t.type <> 'transfer') as transaction_count
from public.transactions t
join public.accounts a on a.id = t.account_id
where a.type = 'credit_card' and t.invoice_month is not null
group by t.household_id, t.account_id, t.invoice_month;

-- ============================================================================
-- Funções administrativas (só service_role)
-- ============================================================================
create function public.seed_default_categories(p_household_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_parent uuid;
begin
  for r in
    select * from (values
      ('expense', 'Moradia', array['Aluguel', 'Condomínio', 'Energia', 'Água', 'Gás', 'Internet e telefone', 'Manutenção da casa']),
      ('expense', 'Alimentação', array['Mercado', 'Restaurantes', 'Delivery', 'Padaria e lanches']),
      ('expense', 'Transporte', array['Combustível', 'App de transporte', 'Transporte público', 'Estacionamento e pedágio', 'Manutenção do carro', 'Seguro e IPVA']),
      ('expense', 'Saúde', array['Farmácia', 'Consultas e exames', 'Plano de saúde', 'Academia']),
      ('expense', 'Educação', array['Cursos', 'Livros e material']),
      ('expense', 'Lazer', array['Streaming', 'Viagens', 'Passeios e eventos', 'Hobbies']),
      ('expense', 'Compras', array['Roupas', 'Eletrônicos', 'Casa e decoração', 'Presentes']),
      ('expense', 'Cuidados pessoais', array['Salão e barbearia', 'Cosméticos']),
      ('expense', 'Pets', array['Ração', 'Veterinário']),
      ('expense', 'Assinaturas e serviços', array['Software e apps', 'Telefonia']),
      ('expense', 'Impostos e tarifas', array['Tarifas bancárias', 'Juros e multas', 'IOF', 'Impostos']),
      ('expense', 'Doações', array[]::text[]),
      ('expense', 'Outros gastos', array[]::text[]),
      ('income', 'Salário', array[]::text[]),
      ('income', 'Rendimentos', array[]::text[]),
      ('income', 'Reembolsos', array[]::text[]),
      ('income', 'Vendas', array[]::text[]),
      ('income', 'Outras receitas', array[]::text[])
    ) as t (kind, name, children)
  loop
    insert into public.categories (household_id, name, kind)
    values (p_household_id, r.name, r.kind::public.category_kind)
    on conflict (household_id, parent_id, name) do update set name = excluded.name
    returning id into v_parent;

    insert into public.categories (household_id, parent_id, name, kind)
    select p_household_id, v_parent, c, r.kind::public.category_kind
    from unnest(r.children) as c
    on conflict (household_id, parent_id, name) do nothing;
  end loop;
end;
$$;

-- Vincula um usuário autenticado ao household do casal (cria o household no 1º acesso).
-- A checagem da lista de e-mails autorizados acontece no servidor antes desta chamada.
create function public.bootstrap_member(p_user_id uuid, p_email text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid;
begin
  perform pg_advisory_xact_lock(hashtext('financas.bootstrap_member'));

  select m.household_id into v_household from public.members m where m.user_id = p_user_id;
  if v_household is not null then
    return v_household;
  end if;

  select h.id into v_household from public.households h order by h.created_at, h.id limit 1;
  if v_household is null then
    insert into public.households default values returning id into v_household;
    perform public.seed_default_categories(v_household);
  end if;

  insert into public.members (household_id, user_id, email, display_name)
  values (v_household, p_user_id, lower(p_email), p_display_name);

  return v_household;
end;
$$;

-- ============================================================================
-- Permissões
-- ============================================================================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- O segredo da Pluggy não é legível por usuários (nem cifrado).
revoke select on public.bank_connections from authenticated;
grant select (id, household_id, member_id, provider, label, client_id, item_id,
  last_synced_at, last_sync_status, last_error, created_at)
  on public.bank_connections to authenticated;

revoke execute on function public.current_household_id() from public, anon;
grant execute on function public.current_household_id() to authenticated, service_role;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
grant execute on function public.seed_default_categories(uuid) to service_role;
revoke execute on function public.bootstrap_member(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_member(uuid, text, text) to service_role;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.receipts enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.bank_connections enable row level security;
alter table public.bank_account_links enable row level security;

create policy households_select on public.households for select to authenticated
  using (id = public.current_household_id());
create policy households_update on public.households for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

create policy members_select on public.members for select to authenticated
  using (household_id = public.current_household_id());
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());

create policy accounts_all on public.accounts for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy categories_all on public.categories for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy receipts_all on public.receipts for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy transactions_all on public.transactions for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy category_rules_all on public.category_rules for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy budgets_all on public.budgets for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy bank_connections_all on public.bank_connections for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
create policy bank_account_links_all on public.bank_account_links for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ============================================================================
-- Storage: bucket privado de comprovantes, pasta = household_id
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

create policy receipts_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text);
create policy receipts_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text);
create policy receipts_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_household_id()::text);
