-- Archivar cuentas de cobro (en lugar de eliminarlas).
alter table public.billing_submissions
  add column if not exists archived_at timestamptz;

create index if not exists billing_submissions_archived_idx
  on public.billing_submissions (archived_at);
