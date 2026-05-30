drop function if exists public.reset_complaint_number_counter();

create or replace function public.reset_complaint_number_counter(actor_user_id uuid)
returns table (
  max_complaint_number bigint,
  next_complaint_number bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  complaint_max bigint;
  next_number bigint;
begin
  if not exists (
    select 1
    from public.users u
    where u.id = actor_user_id
      and u.role = 'admin'
      and u.is_active
  ) then
    raise exception 'Only administrators can reset the complaint counter';
  end if;

  select coalesce(max(number), 0)
    into complaint_max
  from public.complaints;

  next_number := complaint_max + 1;

  perform setval('public.complaint_number_seq', next_number, false);

  return query
  select complaint_max, next_number;
end;
$$;

revoke all on function public.reset_complaint_number_counter(uuid) from public;
grant execute on function public.reset_complaint_number_counter(uuid) to anon, authenticated;
