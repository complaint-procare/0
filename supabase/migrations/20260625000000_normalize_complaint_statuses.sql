do $$
declare
  canonical_names text[] := array[
    'Новий',
    'В роботі',
    'В роботі виробництво',
    'В роботі ВКЯ',
    'В роботі продакт-менеджер',
    'Очікує відповідь клієнта',
    'Очікує ВКЯ',
    'Закрито',
    'Відхилено'
  ];
  item record;
  canonical_id uuid;
  picked_color text;
begin
  for item in
    select *
    from (
      values
        ('Новий', 10, false, '#1FC791', array['Новий', 'Нова']::text[]),
        ('В роботі', 20, false, '#D97706', array['В роботі']::text[]),
        ('В роботі виробництво', 30, false, '#D97706', array['В роботі виробництво']::text[]),
        ('В роботі ВКЯ', 40, false, '#D97706', array['В роботі ВКЯ']::text[]),
        ('В роботі продакт-менеджер', 50, false, '#D97706', array['В роботі продакт-менеджер']::text[]),
        ('Очікує відповідь клієнта', 60, false, '#7C3AED', array['Очікує відповідь клієнта']::text[]),
        ('Очікує ВКЯ', 70, false, '#7C3AED', array['Очікує ВКЯ']::text[]),
        ('Закрито', 80, true, '#000000', array['Закрито', 'Закрита']::text[]),
        ('Відхилено', 90, true, '#DC2626', array['Відхилено', 'Відхилена']::text[])
    ) as desired(name, sort_order, is_closed, fallback_color, aliases)
  loop
    canonical_id := null;
    picked_color := null;

    select status.id, nullif(status.color, '')
      into canonical_id, picked_color
    from public.complaint_statuses status
    where status.name = item.name
    order by status.is_active desc, status.sort_order, status.id
    limit 1;

    if picked_color is null then
      select nullif(status.color, '')
        into picked_color
      from public.complaint_statuses status
      where status.name = any(item.aliases)
        and nullif(status.color, '') is not null
      order by
        case when status.name = item.name then 0 else 1 end,
        status.is_active desc,
        status.sort_order,
        status.id
      limit 1;
    end if;

    if canonical_id is null then
      insert into public.complaint_statuses (
        name,
        sort_order,
        color,
        is_closed,
        is_active
      )
      values (
        item.name,
        item.sort_order,
        coalesce(picked_color, item.fallback_color),
        item.is_closed,
        true
      )
      returning id into canonical_id;
    else
      update public.complaint_statuses
      set
        sort_order = item.sort_order,
        color = coalesce(picked_color, nullif(color, ''), item.fallback_color),
        is_closed = item.is_closed,
        is_active = true
      where id = canonical_id;
    end if;

    update public.complaints
    set status_id = canonical_id
    where status_id in (
      select status.id
      from public.complaint_statuses status
      where status.name = any(item.aliases)
        and status.id <> canonical_id
    );

    update public.complaint_statuses
    set is_active = false
    where name = any(item.aliases)
      and id <> canonical_id;
  end loop;

  update public.complaint_statuses
  set is_active = false
  where name <> all(canonical_names);
end $$;
