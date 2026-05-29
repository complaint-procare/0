alter table public.complaint_summary_rows
  add column if not exists resend_requested_at timestamptz;

comment on column public.complaint_summary_rows.resend_requested_at is
  'Manual resend marker. Updated by the app refresh button so integration webhooks can intentionally reprocess a complaint.';

create or replace function public.request_complaint_resend(complaint_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  insert into public.complaint_summary_rows (
    complaint_id,
    complaint_number,
    complaint_created_at,
    created_by_id,
    created_by_name,
    product_name,
    description,
    resend_requested_at,
    synced_at
  )
  select
    c.id,
    c.number,
    c.created_at,
    c.created_by,
    coalesce(u.full_name, ''),
    coalesce(c.product_name, ''),
    coalesce(c.problem_description, ''),
    now(),
    now()
  from public.complaints c
  left join public.users u on u.id = c.created_by
  where c.id = complaint_uuid
  on conflict (complaint_id) do update set
    complaint_number = excluded.complaint_number,
    complaint_created_at = excluded.complaint_created_at,
    created_by_id = excluded.created_by_id,
    created_by_name = excluded.created_by_name,
    product_name = excluded.product_name,
    description = excluded.description,
    resend_requested_at = excluded.resend_requested_at,
    synced_at = now();

  get diagnostics affected_rows = row_count;

  if affected_rows = 0 then
    raise exception 'Complaint % not found', complaint_uuid;
  end if;
end;
$$;

revoke all on function public.request_complaint_resend(uuid) from public;
grant execute on function public.request_complaint_resend(uuid) to anon, authenticated;
