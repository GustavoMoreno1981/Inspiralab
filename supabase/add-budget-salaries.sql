-- Corre esto en Supabase SQL Editor

alter table public.accounting_budgets
  add column if not exists salaries_cop numeric not null default 0;
