-- Políticas anon para la jerarquía Actividad → Tarea → Subtarea
-- Corre esto en Supabase SQL Editor si usas la anon key (sin service_role).

drop policy if exists "anon_all_activities" on public.activities;
drop policy if exists "anon_all_tasks" on public.tasks;
drop policy if exists "anon_all_subtasks" on public.subtasks;
drop policy if exists "anon_all_team_members" on public.team_members;
drop policy if exists "anon_all_site_content" on public.site_content;

create policy "anon_all_site_content"
  on public.site_content
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_all_team_members"
  on public.team_members
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_all_activities"
  on public.activities
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_all_tasks"
  on public.tasks
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_all_subtasks"
  on public.subtasks
  for all
  to anon
  using (true)
  with check (true);
