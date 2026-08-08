-- Migra el esquema antiguo (tasks + subtasks) a Actividad → Tarea → Subtarea.
-- Seguro para re-ejecutar. Corre TODO el archivo de una vez en Supabase SQL Editor.

create table if not exists public.activities (
  id text primary key,
  title text not null,
  date date not null,
  finished_date date,
  process_url text not null default '',
  deliverable_url text not null default '',
  status text not null check (
    status in ('waiting', 'in_progress', 'paused', 'pending_review', 'done')
  ),
  assignee_ids text[] not null default '{}',
  notes jsonb not null default '[]'::jsonb,
  review_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  tasks_is_old boolean := false;
  tasks_is_new boolean := false;
  tasks_exists boolean := false;
  v2_exists boolean := false;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tasks'
  ) into tasks_exists;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tasks_v2'
  ) into v2_exists;

  if tasks_exists then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'date'
    ) into tasks_is_old;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'activity_id'
    ) into tasks_is_new;
  end if;

  -- Ya migrado: nada más que hacer con el swap.
  if tasks_is_new and not tasks_is_old then
    raise notice 'Migración ya aplicada (tasks.activity_id existe).';
    return;
  end if;

  -- Copiar tasks antiguas → activities (columnas opcionales notes / review_messages)
  if tasks_is_old then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'notes'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = 'review_messages'
    ) then
      execute $q$
        insert into public.activities (
          id, title, date, finished_date, process_url, deliverable_url,
          status, assignee_ids, notes, review_messages, created_at, updated_at
        )
        select
          t.id, t.title, t.date, t.finished_date,
          coalesce(t.process_url, ''), coalesce(t.deliverable_url, ''),
          t.status, coalesce(t.assignee_ids, '{}'),
          coalesce(t.notes, '[]'::jsonb),
          coalesce(t.review_messages, '[]'::jsonb),
          t.created_at, t.updated_at
        from public.tasks t
        where not exists (select 1 from public.activities a where a.id = t.id)
      $q$;
    else
      execute $q$
        insert into public.activities (
          id, title, date, finished_date, process_url, deliverable_url,
          status, assignee_ids, created_at, updated_at
        )
        select
          t.id, t.title, t.date, t.finished_date,
          coalesce(t.process_url, ''), coalesce(t.deliverable_url, ''),
          t.status, coalesce(t.assignee_ids, '{}'),
          t.created_at, t.updated_at
        from public.tasks t
        where not exists (select 1 from public.activities a where a.id = t.id)
      $q$;
    end if;
  end if;

  -- Crear tasks_v2 si no existe
  if not v2_exists then
    execute $q$
      create table public.tasks_v2 (
        id text primary key,
        activity_id text not null references public.activities (id) on delete cascade,
        title text not null,
        status text not null default 'waiting',
        done boolean not null default false,
        url text not null default '',
        position integer not null default 0
      )
    $q$;
  end if;

  -- Subtasks antiguas → tareas (solo si subtasks apunta al esquema viejo)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subtasks'
  ) and tasks_is_old then
    execute $q$
      insert into public.tasks_v2 (id, activity_id, title, status, done, url, position)
      select
        s.id,
        s.task_id,
        s.title,
        coalesce(nullif(s.status, ''), case when s.done then 'done' else 'waiting' end),
        coalesce(s.done, false),
        coalesce(s.url, ''),
        coalesce(s.position, 0)
      from public.subtasks s
      where exists (select 1 from public.activities a where a.id = s.task_id)
        and not exists (select 1 from public.tasks_v2 t where t.id = s.id)
    $q$;
  end if;

  -- Actividades sin tareas hijas → una tarea por defecto
  execute $q$
    insert into public.tasks_v2 (id, activity_id, title, status, done, url, position)
    select
      a.id || '-task',
      a.id,
      a.title,
      a.status,
      a.status = 'done',
      '',
      0
    from public.activities a
    where not exists (
      select 1 from public.tasks_v2 t where t.activity_id = a.id
    )
  $q$;

  -- Quitar tablas viejas y promover tasks_v2
  drop table if exists public.subtasks cascade;

  if tasks_exists and tasks_is_old then
    drop table if exists public.tasks cascade;
  elsif tasks_exists and not tasks_is_new then
    -- tasks existe pero no es ni vieja ni nueva (estado raro): reemplazar
    drop table if exists public.tasks cascade;
  elsif tasks_exists and tasks_is_new then
    -- no debería llegar aquí
    null;
  end if;

  -- Si aún no hay public.tasks, renombrar tasks_v2
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tasks'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'tasks_v2'
    ) then
      alter table public.tasks_v2 rename to tasks;
    else
      -- Recuperación: crear tasks vacío con el esquema nuevo
      create table public.tasks (
        id text primary key,
        activity_id text not null references public.activities (id) on delete cascade,
        title text not null,
        status text not null default 'waiting',
        done boolean not null default false,
        url text not null default '',
        position integer not null default 0
      );
      insert into public.tasks (id, activity_id, title, status, done, url, position)
      select
        a.id || '-task', a.id, a.title, a.status, a.status = 'done', '', 0
      from public.activities a;
    end if;
  else
    -- tasks ya existe (nuevo); borrar tasks_v2 residual si quedó
    drop table if exists public.tasks_v2 cascade;
  end if;
end $$;

create table if not exists public.subtasks (
  id text primary key,
  task_id text not null references public.tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  status text not null default 'waiting',
  url text not null default '',
  position integer not null default 0
);

create index if not exists tasks_activity_id_idx on public.tasks (activity_id);
create index if not exists subtasks_task_id_idx on public.subtasks (task_id);

alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
