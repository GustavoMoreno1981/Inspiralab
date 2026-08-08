-- Historial de mensajes de revisión (WhatsApp / copiados)
alter table public.tasks
  add column if not exists review_messages jsonb not null default '[]'::jsonb;

comment on column public.tasks.review_messages is 'Array de mensajes de revisión enviados al equipo';
