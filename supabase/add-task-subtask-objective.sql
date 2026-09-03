-- Objetivo/descripción en texto libre para tareas y subtareas.
alter table public.tasks
  add column if not exists objective text not null default '';

alter table public.subtasks
  add column if not exists objective text not null default '';

comment on column public.tasks.objective is 'Descripción del objetivo de la tarea';
comment on column public.subtasks.objective is 'Descripción del objetivo de la subtarea';
