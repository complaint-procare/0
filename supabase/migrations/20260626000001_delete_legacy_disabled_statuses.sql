do $$
declare
  item record;
  canonical_id uuid;
  legacy_id uuid;
begin
  for item in
    select *
    from (
      values
        ('Нова', 'Новий'),
        ('Закрита', 'Закрито'),
        ('Відхилена', 'Відхилено')
    ) as status_pair(legacy_name, canonical_name)
  loop
    canonical_id := null;
    legacy_id := null;

    select id
      into canonical_id
    from public.complaint_statuses
    where name = item.canonical_name
    limit 1;

    select id
      into legacy_id
    from public.complaint_statuses
    where name = item.legacy_name
    limit 1;

    if legacy_id is null then
      continue;
    end if;

    if canonical_id is null then
      raise exception 'Cannot delete legacy status % because canonical status % does not exist',
        item.legacy_name,
        item.canonical_name;
    end if;

    if legacy_id <> canonical_id then
      update public.complaints
      set status_id = canonical_id
      where status_id = legacy_id;

      update public.complaint_change_log
      set old_value = to_jsonb(canonical_id::text)
      where field_name = 'status_id'
        and old_value = to_jsonb(legacy_id::text);

      update public.complaint_change_log
      set new_value = to_jsonb(canonical_id::text)
      where field_name = 'status_id'
        and new_value = to_jsonb(legacy_id::text);

      delete from public.complaint_statuses
      where id = legacy_id;
    end if;
  end loop;
end $$;
