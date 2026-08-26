-- Beneficiarios asignados a cada sesión del cronograma.
alter table public.workshop_sessions
  add column if not exists beneficiary_ids text[] not null default '{}';
