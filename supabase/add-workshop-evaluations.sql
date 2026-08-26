-- Evaluaciones de seguimiento de talleres (se activan al vencer la fecha del cronograma).
create table if not exists public.workshop_evaluations (
  id text primary key,
  session_id text not null unique,
  content_score integer not null default 0 check (content_score between 0 and 5),
  facilitator_score integer not null default 0 check (facilitator_score between 0 and 5),
  materials_score integer not null default 0 check (materials_score between 0 and 5),
  organization_score integer not null default 0 check (organization_score between 0 and 5),
  impact_score integer not null default 0 check (impact_score between 0 and 5),
  recommend_score integer not null default 0 check (recommend_score between 0 and 5),
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

alter table public.workshop_evaluations enable row level security;

drop policy if exists "anon_all_workshop_evaluations" on public.workshop_evaluations;
create policy "anon_all_workshop_evaluations"
  on public.workshop_evaluations
  for all
  to anon
  using (true)
  with check (true);
