-- Bucket público para fotos, PDFs y adjuntos (producción en Vercel).
-- Ejecutar en Supabase → SQL Editor (proyecto InspiralabOficial).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon_read_uploads" on storage.objects;
drop policy if exists "anon_insert_uploads" on storage.objects;
drop policy if exists "anon_update_uploads" on storage.objects;
drop policy if exists "anon_delete_uploads" on storage.objects;

create policy "anon_read_uploads"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'uploads');

create policy "anon_insert_uploads"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'uploads');

create policy "anon_update_uploads"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'uploads')
  with check (bucket_id = 'uploads');

create policy "anon_delete_uploads"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'uploads');
