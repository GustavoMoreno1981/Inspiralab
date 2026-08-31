-- Preguntas de seguridad adicionales para ítems privados (actividades / banco).

alter table public.private_item_auth
  add column if not exists age_hash text not null default '',
  add column if not exists spouse_name_hash text not null default '',
  add column if not exists school_name_hash text not null default '',
  add column if not exists security_question_keys text[] not null default '{}';
