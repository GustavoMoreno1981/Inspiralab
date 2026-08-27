-- Contraseñas compartidas de admin / equipo (antes en data/auth.json).
-- Ejecutar en Supabase → SQL Editor (proyecto InspiralabOficial).

create table if not exists public.auth_credentials (
  id text primary key default 'main',
  admin_password text not null default 'inspiralab.administracion',
  member_password text not null default 'inspiralab.actividades',
  updated_at timestamptz not null default now()
);

insert into public.auth_credentials (id, admin_password, member_password)
values ('main', 'inspiralab.administracion', 'inspiralab.actividades')
on conflict (id) do nothing;

alter table public.auth_credentials enable row level security;

drop policy if exists "anon_all_auth_credentials" on public.auth_credentials;

create policy "anon_all_auth_credentials"
  on public.auth_credentials
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant all on table public.auth_credentials to anon, authenticated, service_role;
