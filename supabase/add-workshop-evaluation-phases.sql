-- Evaluación por fases (antes / durante / después).
-- Guarda el checklist completo en content jsonb; conserva session_id.

alter table public.workshop_evaluations
  add column if not exists content jsonb not null default '{}'::jsonb;

comment on column public.workshop_evaluations.content is
  'Documento de evaluación por fases (fields, phaseStatus, etc.)';

-- Las columnas antiguas de scores se dejan por compatibilidad; la app lee/escribe content.
