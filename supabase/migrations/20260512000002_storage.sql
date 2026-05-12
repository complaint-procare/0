-- Complaint CRM — Supabase Storage bucket for media
-- Use this as a fallback / cache before files are mirrored to Google Drive.
-- Files are organised under: complaint-media/<complaint_id>/<file_id>-<filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-media',
  'complaint-media',
  false,                -- private; signed URLs only
  104857600,            -- 100 MB per file
  null                  -- allow any MIME (validate in Edge Function)
)
on conflict (id) do nothing;

-- Policies on storage.objects (Supabase manages the table; we attach policies)
create policy "complaint-media: staff read"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'complaint-media'
    and public.is_staff()
  );

create policy "complaint-media: staff upload"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'complaint-media'
    and public.is_staff()
  );

create policy "complaint-media: staff update own"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'complaint-media'
    and public.is_staff()
  )
  with check (
    bucket_id = 'complaint-media'
    and public.is_staff()
  );

create policy "complaint-media: admin delete"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'complaint-media'
    and public.is_admin()
  );
