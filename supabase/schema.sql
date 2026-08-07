-- Inspiralab: ejecuta esto en Supabase → SQL Editor → New query → Run

create table if not exists public.site_content (
  id text primary key default 'main',
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id text primary key,
  name text not null,
  role text not null default '',
  email text not null default '',
  photo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  date date not null,
  finished_date date,
  process_url text not null default '',
  deliverable_url text not null default '',
  status text not null check (
    status in ('waiting', 'in_progress', 'paused', 'pending_review', 'done')
  ),
  assignee_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id text primary key,
  task_id text not null references public.tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  status text not null default 'waiting',
  url text not null default '',
  position integer not null default 0
);

create index if not exists subtasks_task_id_idx on public.subtasks (task_id);

-- Acceso solo desde el servidor (service role). Bloqueamos acceso público anónimo.
alter table public.site_content enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

-- Sin policies para anon/authenticated: el backend usa service_role y bypassa RLS.
