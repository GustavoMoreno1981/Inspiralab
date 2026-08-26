-- =============================================================================
-- InspiralabOficial — setup completo para proyecto NUEVO en Supabase
-- Ejecutar UNA vez en: Supabase → SQL Editor → New query → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sitio web (contenido editable)
-- -----------------------------------------------------------------------------
create table if not exists public.site_content (
  id text primary key default 'main',
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2) Equipo / actividades / tareas / subtareas / banco
-- -----------------------------------------------------------------------------
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

comment on column public.team_members.access_role is 'Permiso de panel: admin o member';
comment on column public.team_members.can_login is 'Si el integrante puede iniciar sesión con su email';
comment on column public.team_members.password_hash is 'Hash scrypt salt:hash; nunca exponer al cliente';

create table if not exists public.activities (
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

-- -----------------------------------------------------------------------------
-- 3) Cronograma + seguimiento de talleres
-- -----------------------------------------------------------------------------
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
    status in ('scheduled', 'done', 'cancelled')
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
  content jsonb not null default '{}'::jsonb,
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

-- -----------------------------------------------------------------------------
-- 4) Contabilidad
-- -----------------------------------------------------------------------------
create table if not exists public.accounting_budgets (
  id text primary key,
  year integer not null unique,
  amount_cop numeric not null default 0,
  salaries_cop numeric not null default 0,
  usd_rate numeric not null default 4000,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_beneficiaries (
  id text primary key,
  name text not null,
  contact text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.accounting_activities (
  id text primary key,
  beneficiary_id text not null references public.accounting_beneficiaries (id) on delete restrict,
  title text not null,
  activity_date date not null,
  usd_rate numeric not null default 4000,
  received_cop numeric not null default 0,
  materials_cop numeric not null default 0,
  logistics_cop numeric not null default 0,
  collaborations_cop numeric not null default 0,
  contingencies_cop numeric not null default 0,
  materials_files jsonb not null default '[]'::jsonb,
  logistics_files jsonb not null default '[]'::jsonb,
  collaborations_files jsonb not null default '[]'::jsonb,
  contingencies_files jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_expenses (
  id text primary key,
  category text not null check (
    category in ('equipment', 'internet', 'tools', 'other')
  ),
  title text not null,
  expense_date date not null,
  amount_cop numeric not null default 0,
  usd_rate numeric not null default 4000,
  files jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_activities_beneficiary_idx
  on public.accounting_activities (beneficiary_id);
create index if not exists accounting_activities_date_idx
  on public.accounting_activities (activity_date);
create index if not exists accounting_expenses_date_idx
  on public.accounting_expenses (expense_date);

-- -----------------------------------------------------------------------------
-- 5) RLS
-- -----------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.team_members enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_bank enable row level security;
alter table public.workshop_sessions enable row level security;
alter table public.workshop_evaluations enable row level security;
alter table public.accounting_budgets enable row level security;
alter table public.accounting_beneficiaries enable row level security;
alter table public.accounting_activities enable row level security;
alter table public.accounting_expenses enable row level security;

-- -----------------------------------------------------------------------------
-- 6) Policies anon (por si usas solo ANON key; con SERVICE_ROLE se bypasea RLS)
-- -----------------------------------------------------------------------------
drop policy if exists "anon_all_site_content" on public.site_content;
drop policy if exists "anon_all_team_members" on public.team_members;
drop policy if exists "anon_all_activities" on public.activities;
drop policy if exists "anon_all_tasks" on public.tasks;
drop policy if exists "anon_all_subtasks" on public.subtasks;
drop policy if exists "anon_all_task_bank" on public.task_bank;
drop policy if exists "anon_all_workshop_sessions" on public.workshop_sessions;
drop policy if exists "anon_all_workshop_evaluations" on public.workshop_evaluations;
drop policy if exists "anon_all_accounting_budgets" on public.accounting_budgets;
drop policy if exists "anon_all_accounting_beneficiaries" on public.accounting_beneficiaries;
drop policy if exists "anon_all_accounting_activities" on public.accounting_activities;
drop policy if exists "anon_all_accounting_expenses" on public.accounting_expenses;

create policy "anon_all_site_content"
  on public.site_content for all to anon using (true) with check (true);

create policy "anon_all_team_members"
  on public.team_members for all to anon using (true) with check (true);

create policy "anon_all_activities"
  on public.activities for all to anon using (true) with check (true);

create policy "anon_all_tasks"
  on public.tasks for all to anon using (true) with check (true);

create policy "anon_all_subtasks"
  on public.subtasks for all to anon using (true) with check (true);

create policy "anon_all_task_bank"
  on public.task_bank for all to anon using (true) with check (true);

create policy "anon_all_workshop_sessions"
  on public.workshop_sessions for all to anon using (true) with check (true);

create policy "anon_all_workshop_evaluations"
  on public.workshop_evaluations for all to anon using (true) with check (true);

create policy "anon_all_accounting_budgets"
  on public.accounting_budgets for all to anon using (true) with check (true);

create policy "anon_all_accounting_beneficiaries"
  on public.accounting_beneficiaries for all to anon using (true) with check (true);

create policy "anon_all_accounting_activities"
  on public.accounting_activities for all to anon using (true) with check (true);

create policy "anon_all_accounting_expenses"
  on public.accounting_expenses for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 7) Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant all on table public.site_content to anon, authenticated, service_role;
grant all on table public.team_members to anon, authenticated, service_role;
grant all on table public.activities to anon, authenticated, service_role;
grant all on table public.tasks to anon, authenticated, service_role;
grant all on table public.subtasks to anon, authenticated, service_role;
grant all on table public.task_bank to anon, authenticated, service_role;
grant all on table public.workshop_sessions to anon, authenticated, service_role;
grant all on table public.workshop_evaluations to anon, authenticated, service_role;
grant all on table public.accounting_budgets to anon, authenticated, service_role;
grant all on table public.accounting_beneficiaries to anon, authenticated, service_role;
grant all on table public.accounting_activities to anon, authenticated, service_role;
grant all on table public.accounting_expenses to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) Log de recordatorios del cronograma (5 / 3 / 1 día antes)
-- -----------------------------------------------------------------------------
create table if not exists public.schedule_reminder_log (
  reminder_key text primary key,
  session_id text not null,
  days_before integer not null check (days_before in (1, 3, 5)),
  session_date date not null,
  sent_at timestamptz not null default now()
);

create index if not exists schedule_reminder_log_session_idx
  on public.schedule_reminder_log (session_id);
create index if not exists schedule_reminder_log_date_idx
  on public.schedule_reminder_log (session_date);

alter table public.schedule_reminder_log enable row level security;

drop policy if exists "anon_all_schedule_reminder_log" on public.schedule_reminder_log;
create policy "anon_all_schedule_reminder_log"
  on public.schedule_reminder_log for all to anon using (true) with check (true);

grant all on table public.schedule_reminder_log to anon, authenticated, service_role;
