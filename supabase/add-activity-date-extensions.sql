-- Historial de prórrogas de fecha de fin en actividades
alter table public.activities
  add column if not exists date_extensions jsonb not null default '[]'::jsonb;

comment on column public.activities.date_extensions is 'Array de { id, previousDate, newDate, reason, createdAt } — prórrogas de fecha fin';
