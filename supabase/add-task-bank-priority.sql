-- Prioridad del banco de ideas: urgent (primero), medium, low.
alter table public.task_bank
  add column if not exists priority text not null default 'medium';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_bank_priority_check'
  ) then
    alter table public.task_bank
      add constraint task_bank_priority_check
      check (priority in ('urgent', 'medium', 'low'));
  end if;
end $$;
