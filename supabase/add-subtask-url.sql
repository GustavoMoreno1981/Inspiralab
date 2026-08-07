-- Corre esto en Supabase SQL Editor

alter table public.subtasks
  add column if not exists url text not null default '';
