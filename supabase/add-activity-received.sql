-- Corre esto en Supabase SQL Editor

alter table public.accounting_activities
  add column if not exists received_cop numeric not null default 0;
