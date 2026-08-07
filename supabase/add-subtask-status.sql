-- Corre esto en Supabase SQL Editor

alter table public.subtasks
  add column if not exists status text not null default 'waiting';
