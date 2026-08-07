-- Corre esto en Supabase SQL Editor si ya creaste las tablas antes

alter table public.team_members
  add column if not exists photo text not null default '';
