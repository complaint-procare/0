drop function if exists public.get_complaint_number_counter();

create or replace function public.get_complaint_number_counter()
returns table (
  last_sequence_value bigint,
  sequence_is_called boolean,
  max_complaint_number bigint,
  next_complaint_number bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_last bigint;
  sequence_called boolean;
  complaint_max bigint;
begin
  select last_value, is_called
    into sequence_last, sequence_called
  from public.complaint_number_seq;

  select coalesce(max(number), 0)
    into complaint_max
  from public.complaints;

  return query
  select
    sequence_last,
    sequence_called,
    complaint_max,
    greatest(
      case when sequence_called then sequence_last + 1 else sequence_last end,
      complaint_max + 1
    );
end;
$$;

revoke all on function public.get_complaint_number_counter() from public;
grant execute on function public.get_complaint_number_counter() to anon, authenticated;
