-- Log de recordatorios del cronograma (5 / 3 / 1 día antes)
-- Evita reenviar el mismo aviso. Corre en Supabase SQL Editor.

create table if not exists public.schedule_reminder_log (
  reminder_key text primary key,
  session_id text not null,
  days_before integer not null check (days_before in (1, 3, 5)),
  session_date date not null,
  sent_at timestamptz not null default now()
);

create index if not exists schedule_reminder_log_session_idx
  on public.schedule_reminder_log (session_id);

create index if not exists schedule_reminder_log_date_idx
  on public.schedule_reminder_log (session_date);

alter table public.schedule_reminder_log enable row level security;

drop policy if exists "anon_all_schedule_reminder_log" on public.schedule_reminder_log;
create policy "anon_all_schedule_reminder_log"
  on public.schedule_reminder_log for all to anon using (true) with check (true);

grant all on table public.schedule_reminder_log to anon, authenticated, service_role;
