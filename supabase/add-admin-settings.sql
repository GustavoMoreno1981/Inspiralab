-- Configuración general del panel (p. ej. URL de bitácora).
create table if not exists public.admin_settings (
  id text primary key default 'main',
  bitacora_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id, bitacora_url)
values ('main', '')
on conflict (id) do nothing;

alter table public.admin_settings enable row level security;

comment on table public.admin_settings is 'Ajustes del panel de administración (bitácora, etc.)';
comment on column public.admin_settings.bitacora_url is 'URL que abre el botón Bitácora del panel';
