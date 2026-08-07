-- Acceso al panel por integrante (roles / permisos)
alter table public.team_members
  add column if not exists access_role text not null default 'member'
    check (access_role in ('admin', 'member'));

alter table public.team_members
  add column if not exists can_login boolean not null default false;

alter table public.team_members
  add column if not exists password_hash text not null default '';

comment on column public.team_members.access_role is 'Permiso de panel: admin (3 módulos) o member (sitio + tareas)';
comment on column public.team_members.can_login is 'Si el integrante puede iniciar sesión con su email';
comment on column public.team_members.password_hash is 'Hash scrypt salt:hash; nunca exponer al cliente';
