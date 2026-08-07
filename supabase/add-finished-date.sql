-- Corre esto en Supabase SQL Editor

alter table public.tasks
  add column if not exists finished_date date;
