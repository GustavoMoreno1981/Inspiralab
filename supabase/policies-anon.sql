-- Si usas solo la anon key (sin service_role), corre esto después del schema.sql
-- Necesario porque RLS bloquea lecturas/escrituras anónimas por defecto.

drop policy if exists "anon_all_site_content" on public.site_content;
drop policy if exists "anon_all_team_members" on public.team_members;
drop policy if exists "anon_all_activities" on public.activities;
drop policy if exists "anon_all_tasks" on public.tasks;
drop policy if exists "anon_all_subtasks" on public.subtasks;
drop policy if exists "anon_all_task_bank" on public.task_bank;

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

create policy "anon_all_task_bank"
  on public.task_bank
  for all
  to anon
  using (true)
  with check (true);
