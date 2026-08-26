-- Cronograma: sesiones programadas de talleres.
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

alter table public.workshop_sessions enable row level security;

drop policy if exists "anon_all_workshop_sessions" on public.workshop_sessions;
create policy "anon_all_workshop_sessions"
  on public.workshop_sessions
  for all
  to anon
  using (true)
  with check (true);
