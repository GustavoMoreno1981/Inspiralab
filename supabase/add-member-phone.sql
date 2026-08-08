-- Corre esto en Supabase SQL Editor si ya creaste las tablas antes

alter table public.team_members
  add column if not exists phone_country_code text not null default '+57';

alter table public.team_members
  add column if not exists phone text not null default '';
