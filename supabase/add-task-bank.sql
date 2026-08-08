-- Banco de ideas / propuestas para crear actividades formales.
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

alter table public.task_bank enable row level security;

drop policy if exists "anon_all_task_bank" on public.task_bank;
create policy "anon_all_task_bank"
  on public.task_bank
  for all
  to anon
  using (true)
  with check (true);
