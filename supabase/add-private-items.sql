-- Visibilidad pública/privada en actividades y banco de ideas.
-- Las credenciales (PIN y respuestas) viven en private_item_auth.

alter table public.activities
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  add column if not exists created_by_id text not null default '';

alter table public.task_bank
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  add column if not exists created_by_id text not null default '';

create table if not exists public.private_item_auth (
  item_type text not null check (item_type in ('activity', 'bank')),
  item_id text not null,
  pin_hash text not null default '',
  mother_name_hash text not null default '',
  pet_name_hash text not null default '',
  birth_year_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_type, item_id)
);

alter table public.private_item_auth enable row level security;

drop policy if exists "anon_all_private_item_auth" on public.private_item_auth;
create policy "anon_all_private_item_auth"
  on public.private_item_auth
  for all
  to anon
  using (true)
  with check (true);
