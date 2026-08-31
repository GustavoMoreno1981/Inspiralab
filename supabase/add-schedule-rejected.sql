-- Propuestas rechazadas (no van al calendario).
alter table public.workshop_sessions
  drop constraint if exists workshop_sessions_status_check;

alter table public.workshop_sessions
  add constraint workshop_sessions_status_check
  check (status in ('scheduled', 'done', 'cancelled', 'pending_approval', 'rejected'));
