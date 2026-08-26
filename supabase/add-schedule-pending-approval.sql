-- Propuestas pendientes de aprobación (no van al calendario hasta aprobar).
-- Tabla real del proyecto: workshop_sessions (ver supabase/add-schedule.sql).

alter table public.workshop_sessions
  drop constraint if exists workshop_sessions_status_check;

alter table public.workshop_sessions
  add constraint workshop_sessions_status_check
  check (status in ('scheduled', 'done', 'cancelled', 'pending_approval'));
