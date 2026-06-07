-- ============================================================
-- Sistema de Gestão de TI — Prefeitura de Morretes
-- Schema Postgres (rodado automaticamente pelo Docker no 1º start)
-- ============================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------- Tipos (enums) ----------
do $$ begin create type papel as enum ('gestor', 'tecnico'); exception when duplicate_object then null; end $$;
do $$ begin create type prioridade as enum ('Crítico', 'Alto', 'Médio', 'Baixo'); exception when duplicate_object then null; end $$;
do $$ begin create type status_tarefa as enum ('A fazer', 'Em andamento', 'Bloqueado', 'Concluído'); exception when duplicate_object then null; end $$;
do $$ begin create type status_projeto as enum ('Planejado', 'Em andamento', 'Pausado', 'Concluído'); exception when duplicate_object then null; end $$;
do $$ begin create type status_chamado as enum ('Aberto', 'Em atendimento', 'Resolvido', 'Cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type categoria_ti as enum ('Suporte', 'Infraestrutura', 'Sistemas', 'LGPD', 'Administrativo'); exception when duplicate_object then null; end $$;

-- ---------- Usuários (equipe + login) ----------
create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null unique,
  senha_hash  text not null,
  cargo       text,
  papel       papel not null default 'tecnico',
  telefone    text,                 -- WhatsApp E.164: 5541999999999
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Projetos ----------
create table if not exists projetos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  descricao           text,
  status              status_projeto not null default 'Planejado',
  inicio_previsto     date,
  conclusao_prevista  date,
  responsavel_id      uuid references usuarios(id) on delete set null,
  created_by          uuid references usuarios(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ---------- Chamados (portal público) ----------
create table if not exists chamados (
  id                  uuid primary key default gen_random_uuid(),
  protocolo           text unique not null default to_char(now(),'YYYY') || '-' || lpad((floor(random()*100000))::text, 5, '0'),
  titulo              text not null,
  descricao           text,
  solicitante_nome    text not null,
  solicitante_contato text,
  setor               text,
  categoria           categoria_ti default 'Suporte',
  prioridade          prioridade not null default 'Médio',
  status              status_chamado not null default 'Aberto',
  created_at          timestamptz not null default now()
);

-- ---------- Tarefas ----------
create table if not exists tarefas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  categoria       categoria_ti default 'Suporte',
  prioridade      prioridade not null default 'Médio',
  status          status_tarefa not null default 'A fazer',
  prazo           timestamptz,
  projeto_id      uuid references projetos(id) on delete set null,
  responsavel_id  uuid references usuarios(id) on delete set null,
  chamado_id      uuid references chamados(id) on delete set null,
  created_by      uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tarefas_responsavel on tarefas(responsavel_id);
create index if not exists idx_tarefas_status on tarefas(status);
create index if not exists idx_tarefas_prazo on tarefas(prazo);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tarefas_touch on tarefas;
create trigger trg_tarefas_touch before update on tarefas
  for each row execute function touch_updated_at();

-- ---------- Assinaturas de Web Push ----------
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Log de notificações ----------
create table if not exists notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references usuarios(id) on delete cascade,
  titulo      text not null,
  corpo       text,
  canal       text,
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
