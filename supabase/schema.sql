-- Inspiralab: schema base.
-- Para proyecto NUEVO usa full-setup.sql (incluye contabilidad + policies + grants).

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
  phone_country_code text not null default '+57',
  phone text not null default '',
  access_role text not null default 'member'
    check (access_role in ('admin', 'member')),
  can_login boolean not null default false,
  password_hash text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  title text not null,
  objective text not null default '',
  date date not null,
  finished_date date,
  process_url text not null default '',
  deliverable_url text not null default '',
  status text not null check (
    status in ('waiting', 'in_progress', 'paused', 'pending_review', 'done')
  ),
  assignee_ids text[] not null default '{}',
  notes jsonb not null default '[]'::jsonb,
  review_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  activity_id text not null references public.activities (id) on delete cascade,
  title text not null,
  status text not null default 'waiting',
  done boolean not null default false,
  url text not null default '',
  position integer not null default 0
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

create index if not exists tasks_activity_id_idx on public.tasks (activity_id);
create index if not exists subtasks_task_id_idx on public.subtasks (task_id);

create table if not exists public.task_bank (
  id text primary key,
  title text not null default '',
  notes text not null default '',
  owner_id text not null default '',
  suggested_assignee_ids text[] not null default '{}',
  converted_activity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_bank_owner_idx on public.task_bank (owner_id);

create table if not exists public.workshop_sessions (
  id text primary key,
  kind text not null default 'workshop' check (kind in ('workshop', 'event')),
  event_name text not null default '',
  workshop_id text not null default '',
  flower_index integer not null default -1,
  title text not null default '',
  session_date date not null,
  start_time text not null default '',
  end_time text not null default '',
  location text not null default '',
  coach text not null default '',
  beneficiary_ids text[] not null default '{}',
  status text not null default 'scheduled' check (
    status in ('scheduled', 'done', 'cancelled', 'pending_approval')
  ),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_sessions_date_idx
  on public.workshop_sessions (session_date);

create table if not exists public.workshop_evaluations (
  id text primary key,
  session_id text not null unique,
  content_score integer not null default 0,
  facilitator_score integer not null default 0,
  materials_score integer not null default 0,
  organization_score integer not null default 0,
  impact_score integer not null default 0,
  recommend_score integer not null default 0,
  highlights text not null default '',
  improvements text not null default '',
  notes text not null default '',
  evaluated_by text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_evaluations_session_idx
  on public.workshop_evaluations (session_id);

alter table public.site_content enable row level security;
alter table public.team_members enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_bank enable row level security;
alter table public.workshop_sessions enable row level security;
alter table public.workshop_evaluations enable row level security;
