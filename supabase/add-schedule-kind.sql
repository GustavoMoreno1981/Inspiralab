-- Tipo de sesión: taller o evento.
alter table public.workshop_sessions
  add column if not exists kind text not null default 'workshop';

alter table public.workshop_sessions
  add column if not exists event_name text not null default '';

-- Restringe valores conocidos (si ya existe el check, ignora el error al re-ejecutar).
do $$
begin
  alter table public.workshop_sessions
    add constraint workshop_sessions_kind_check
    check (kind in ('workshop', 'event'));
exception
  when duplicate_object then null;
end $$;
