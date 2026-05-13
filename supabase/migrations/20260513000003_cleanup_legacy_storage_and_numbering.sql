-- Remove legacy settings/storage artifacts now that attachments are stored in
-- Google Drive through OAuth, and align complaint numbering with the DB sequence.

delete from public.app_settings
where key = 'drive.base_folder';

select setval(
  'public.complaint_number_seq',
  coalesce((select max(number) from public.complaints), 0) + 1,
  false
);

drop policy if exists "complaint-media: staff read" on storage.objects;
drop policy if exists "complaint-media: staff upload" on storage.objects;
drop policy if exists "complaint-media: staff update own" on storage.objects;
drop policy if exists "complaint-media: admin delete" on storage.objects;
