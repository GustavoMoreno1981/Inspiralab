-- Cuentas de cobro del equipo (quincenas).
create table if not exists public.billing_submissions (
  id text primary key,
  member_id text not null references public.team_members (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  file_url text not null default '',
  file_name text not null default '',
  activities jsonb not null default '[]'::jsonb,
  notes text not null default '',
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed', 'paid')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists billing_submissions_member_idx
  on public.billing_submissions (member_id);

create index if not exists billing_submissions_period_idx
  on public.billing_submissions (period_start, period_end);

alter table public.billing_submissions enable row level security;

drop policy if exists "anon_all_billing_submissions" on public.billing_submissions;
create policy "anon_all_billing_submissions"
  on public.billing_submissions
  for all
  to anon
  using (true)
  with check (true);
