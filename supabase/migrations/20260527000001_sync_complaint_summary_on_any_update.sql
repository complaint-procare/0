-- Ensure manual "refresh complaint" actions also update the integration table.
-- The app's refresh button intentionally updates only complaints.updated_at.

drop trigger if exists complaints_sync_summary_row on public.complaints;

create trigger complaints_sync_summary_row
  after insert or update
  on public.complaints
  for each row execute function public.sync_complaint_summary_row();
