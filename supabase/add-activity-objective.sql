-- Descripción del objetivo de la actividad (texto libre, además del título corto).
alter table public.activities
  add column if not exists objective text not null default '';

comment on column public.activities.objective is 'Descripción del objetivo en texto libre';
