-- Policies anon para contabilidad (si usas anon key)

drop policy if exists "anon_all_accounting_budgets" on public.accounting_budgets;
drop policy if exists "anon_all_accounting_beneficiaries" on public.accounting_beneficiaries;
drop policy if exists "anon_all_accounting_activities" on public.accounting_activities;
drop policy if exists "anon_all_accounting_expenses" on public.accounting_expenses;

create policy "anon_all_accounting_budgets"
  on public.accounting_budgets for all to anon using (true) with check (true);

create policy "anon_all_accounting_beneficiaries"
  on public.accounting_beneficiaries for all to anon using (true) with check (true);

create policy "anon_all_accounting_activities"
  on public.accounting_activities for all to anon using (true) with check (true);

create policy "anon_all_accounting_expenses"
  on public.accounting_expenses for all to anon using (true) with check (true);
