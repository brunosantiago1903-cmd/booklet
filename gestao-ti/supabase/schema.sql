-- ============================================================
-- Sistema de Gestão de TI — Prefeitura de Morretes
-- Schema Supabase / Postgres
-- Rode este arquivo no Supabase: SQL Editor > New query > cole > Run
-- ============================================================

-- ---------- Tipos (enums) ----------
do $$ begin
  create type papel as enum ('gestor', 'tecnico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('Crítico', 'Alto', 'Médio', 'Baixo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_tarefa as enum ('A fazer', 'Em andamento', 'Bloqueado', 'Concluído');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_projeto as enum ('Planejado', 'Em andamento', 'Pausado', 'Concluído');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_chamado as enum ('Aberto', 'Em atendimento', 'Resolvido', 'Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categoria_ti as enum ('Suporte', 'Infraestrutura', 'Sistemas', 'LGPD', 'Administrativo');
exception when duplicate_object then null; end $$;

-- ---------- Perfis (estende auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  cargo       text default '',
  papel       papel not null default 'tecnico',
  telefone    text,                 -- WhatsApp em formato E.164: 5541999999999
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Projetos ----------
create table if not exists public.projetos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  descricao           text,
  status              status_projeto not null default 'Planejado',
  inicio_previsto     date,
  conclusao_prevista  date,
  responsavel_id      uuid references public.profiles(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ---------- Chamados (suporte; portal público) ----------
create table if not exists public.chamados (
  id                  uuid primary key default gen_random_uuid(),
  protocolo           text unique not null default to_char(now(),'YYYY') || '-' || lpad((floor(random()*100000))::text, 5, '0'),
  titulo              text not null,
  descricao           text,
  solicitante_nome    text not null,
  solicitante_contato text,          -- telefone/e-mail de quem abriu
  setor               text,
  categoria           categoria_ti default 'Suporte',
  prioridade          prioridade not null default 'Médio',
  status              status_chamado not null default 'Aberto',
  created_at          timestamptz not null default now()
);

-- ---------- Tarefas ----------
create table if not exists public.tarefas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  categoria       categoria_ti default 'Suporte',
  prioridade      prioridade not null default 'Médio',
  status          status_tarefa not null default 'A fazer',
  prazo           timestamptz,
  projeto_id      uuid references public.projetos(id) on delete set null,
  responsavel_id  uuid references public.profiles(id) on delete set null,
  chamado_id      uuid references public.chamados(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tarefas_responsavel on public.tarefas(responsavel_id);
create index if not exists idx_tarefas_status on public.tarefas(status);
create index if not exists idx_tarefas_prazo on public.tarefas(prazo);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tarefas_touch on public.tarefas;
create trigger trg_tarefas_touch before update on public.tarefas
  for each row execute function public.touch_updated_at();

-- ---------- Assinaturas de Web Push ----------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Log de notificações ----------
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles(id) on delete cascade,
  titulo      text not null,
  corpo       text,
  canal       text,                  -- 'push' | 'whatsapp'
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Segurança por linha (RLS)
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.projetos           enable row level security;
alter table public.tarefas            enable row level security;
alter table public.chamados           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notificacoes       enable row level security;

-- Perfis: a equipe (logada) enxerga todos; cada um edita o próprio
drop policy if exists "perfis_select" on public.profiles;
create policy "perfis_select" on public.profiles for select to authenticated using (true);
drop policy if exists "perfis_update_self" on public.profiles;
create policy "perfis_update_self" on public.profiles for update to authenticated using (auth.uid() = id);

-- Projetos e Tarefas: equipe logada tem acesso total
drop policy if exists "projetos_all" on public.projetos;
create policy "projetos_all" on public.projetos for all to authenticated using (true) with check (true);

drop policy if exists "tarefas_all" on public.tarefas;
create policy "tarefas_all" on public.tarefas for all to authenticated using (true) with check (true);

-- Chamados: QUALQUER UM pode abrir (insert anônimo); só a equipe lê/atualiza
drop policy if exists "chamados_insert_publico" on public.chamados;
create policy "chamados_insert_publico" on public.chamados for insert to anon, authenticated with check (true);
drop policy if exists "chamados_select_equipe" on public.chamados;
create policy "chamados_select_equipe" on public.chamados for select to authenticated using (true);
drop policy if exists "chamados_update_equipe" on public.chamados;
create policy "chamados_update_equipe" on public.chamados for update to authenticated using (true);

-- Push subscriptions: cada usuário gerencia as próprias
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Notificações: cada usuário lê as próprias
drop policy if exists "notif_own" on public.notificacoes;
create policy "notif_own" on public.notificacoes for select to authenticated using (auth.uid() = profile_id);
