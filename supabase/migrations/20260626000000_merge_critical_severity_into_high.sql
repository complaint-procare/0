do $$
declare
  high_id uuid;
  critical_id uuid;
  high_color text;
  critical_color text;
begin
  select id, nullif(color, '')
    into high_id, high_color
  from public.severity_levels
  where name = 'Висока'
  limit 1;

  select id, nullif(color, '')
    into critical_id, critical_color
  from public.severity_levels
  where name = 'Критична'
  limit 1;

  if high_id is null then
    insert into public.severity_levels (
      name,
      sort_order,
      color,
      is_active
    )
    values (
      'Висока',
      40,
      coalesce(critical_color, '#EA580C'),
      true
    )
    returning id, color into high_id, high_color;
  else
    update public.severity_levels
    set
      sort_order = 40,
      color = coalesce(high_color, nullif(color, ''), '#EA580C'),
      is_active = true
    where id = high_id;
  end if;

  if critical_id is not null and critical_id <> high_id then
    update public.complaints
    set severity_id = high_id
    where severity_id = critical_id;

    update public.complaint_change_log
    set old_value = to_jsonb(high_id::text)
    where field_name = 'severity_id'
      and old_value = to_jsonb(critical_id::text);

    update public.complaint_change_log
    set new_value = to_jsonb(high_id::text)
    where field_name = 'severity_id'
      and new_value = to_jsonb(critical_id::text);

    delete from public.severity_levels
    where id = critical_id;
  end if;
end $$;
