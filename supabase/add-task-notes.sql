-- Notas de tarea (texto + fecha de creación)
alter table public.tasks
  add column if not exists notes jsonb not null default '[]'::jsonb;

comment on column public.tasks.notes is 'Array de { id, text, createdAt } — bitácora de la tarea';
