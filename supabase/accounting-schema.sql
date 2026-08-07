-- Contabilidad Inspiralab: corre esto en Supabase SQL Editor

create table if not exists public.accounting_budgets (
  id text primary key,
  year integer not null unique,
  amount_cop numeric not null default 0,
  salaries_cop numeric not null default 0,
  usd_rate numeric not null default 4000,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_beneficiaries (
  id text primary key,
  name text not null,
  contact text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.accounting_activities (
  id text primary key,
  beneficiary_id text not null references public.accounting_beneficiaries (id) on delete restrict,
  title text not null,
  activity_date date not null,
  usd_rate numeric not null default 4000,
  received_cop numeric not null default 0,
  materials_cop numeric not null default 0,
  logistics_cop numeric not null default 0,
  collaborations_cop numeric not null default 0,
  contingencies_cop numeric not null default 0,
  materials_files jsonb not null default '[]'::jsonb,
  logistics_files jsonb not null default '[]'::jsonb,
  collaborations_files jsonb not null default '[]'::jsonb,
  contingencies_files jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_expenses (
  id text primary key,
  category text not null check (
    category in ('equipment', 'internet', 'tools', 'other')
  ),
  title text not null,
  expense_date date not null,
  amount_cop numeric not null default 0,
  usd_rate numeric not null default 4000,
  files jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_activities_beneficiary_idx
  on public.accounting_activities (beneficiary_id);
create index if not exists accounting_activities_date_idx
  on public.accounting_activities (activity_date);
create index if not exists accounting_expenses_date_idx
  on public.accounting_expenses (expense_date);

alter table public.accounting_budgets enable row level security;
alter table public.accounting_beneficiaries enable row level security;
alter table public.accounting_activities enable row level security;
alter table public.accounting_expenses enable row level security;
