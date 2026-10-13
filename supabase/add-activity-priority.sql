-- Prioridad de actividades: urgent (primero), medium, low.
alter table public.activities
  add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_priority_check'
  ) then
    alter table public.activities
      add constraint activities_priority_check
      check (priority in ('urgent', 'medium', 'low'));
  end if;
end $$;
