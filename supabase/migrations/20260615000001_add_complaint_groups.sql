create table if not exists public.complaint_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.complaint_groups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'complaint_groups'
      and policyname = 'complaint_groups_select'
  ) then
    create policy complaint_groups_select on public.complaint_groups
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'complaint_groups'
      and policyname = 'complaint_groups_admin_write'
  ) then
    create policy complaint_groups_admin_write on public.complaint_groups
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'complaint_groups'
      and policyname = 'complaint_groups_anon_all'
  ) then
    create policy complaint_groups_anon_all on public.complaint_groups
      for all to anon using (true) with check (true);
  end if;
end $$;

insert into public.complaint_groups (name, sort_order, is_active) values
  ('Етикування', 10, true),
  ('Сировина', 20, true),
  ('Комплектуючі', 30, true),
  ('Терміни', 40, true),
  ('Реакція на використання', 50, true),
  ('Логістичні скарги', 60, true),
  ('Інші', 70, true)
on conflict (name) do nothing;

alter table public.complaints
  add column if not exists complaint_group_id uuid references public.complaint_groups(id) on delete set null;

create index if not exists complaints_group_idx on public.complaints (complaint_group_id);

update public.complaints
set complaint_group_id = fallback_group.id
from (
  select id
  from public.complaint_groups
  where name = 'Інші'
  limit 1
) as fallback_group
where public.complaints.complaint_group_id is null;

with e as (
  select id
  from public.entity_definitions
  where entity_key = 'complaints'
),
positions as (
  select
    e.id as entity_id,
    coalesce(
      (
        select sort_order + 5
        from public.field_definitions
        where entity_id = e.id
          and field_key = 'batch_number'
        limit 1
      ),
      85
    ) as sort_order
  from e
)
insert into public.field_definitions (
  entity_id,
  field_key,
  label,
  field_type,
  is_system,
  is_required,
  is_active,
  is_visible,
  show_in_create,
  show_in_details,
  show_in_registry,
  sort_order
)
select
  entity_id,
  'complaint_group_id',
  'Група скарги',
  'reference'::public.field_type,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  sort_order
from positions
on conflict (entity_id, field_key) do update set
  label = excluded.label,
  field_type = excluded.field_type,
  is_system = true,
  is_required = true,
  is_active = true,
  is_visible = true,
  show_in_create = true,
  show_in_details = true,
  show_in_registry = true,
  sort_order = excluded.sort_order;
