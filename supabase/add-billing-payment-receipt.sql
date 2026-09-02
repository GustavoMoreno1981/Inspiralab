-- Recibo de pago que sube el integrante tras recibir el pago.
alter table public.billing_submissions
  add column if not exists payment_receipt_url text not null default '',
  add column if not exists payment_receipt_name text not null default '',
  add column if not exists payment_receipt_at timestamptz;
