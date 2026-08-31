-- Vincula actividades contables con sesiones aprobadas del cronograma.
alter table public.accounting_activities
  add column if not exists schedule_session_id text;

create index if not exists accounting_activities_schedule_session_idx
  on public.accounting_activities (schedule_session_id)
  where schedule_session_id is not null;
