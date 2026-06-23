create table public.complaint_views (
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (complaint_id, user_id)
);

create index complaint_views_user_idx
  on public.complaint_views (user_id, viewed_at desc);

alter table public.complaint_views enable row level security;

create or replace function public.record_complaint_view(
  complaint_uuid uuid,
  viewer_uuid uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users u
    where u.id = viewer_uuid
      and u.is_active
  ) then
    raise exception 'Active viewer not found';
  end if;

  if not exists (
    select 1
    from public.complaints c
    where c.id = complaint_uuid
  ) then
    raise exception 'Complaint not found';
  end if;

  insert into public.complaint_views (complaint_id, user_id)
  values (complaint_uuid, viewer_uuid)
  on conflict (complaint_id, user_id) do nothing;
end;
$$;

create or replace function public.get_complaint_view_counts()
returns table (
  complaint_id uuid,
  unique_views bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cv.complaint_id,
    count(*)::bigint as unique_views
  from public.complaint_views cv
  group by cv.complaint_id;
$$;

revoke all on function public.record_complaint_view(uuid, uuid) from public;
revoke all on function public.get_complaint_view_counts() from public;
grant execute on function public.record_complaint_view(uuid, uuid) to anon, authenticated;
grant execute on function public.get_complaint_view_counts() to anon, authenticated;

comment on table public.complaint_views is
  'One immutable row per complaint and app user. Repeated opens do not increase the unique view count.';
comment on function public.get_complaint_view_counts() is
  'Returns only aggregated unique viewer counts without exposing viewer user IDs.';
