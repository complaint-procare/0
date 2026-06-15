alter table public.complaints
  add column if not exists resolution_response text not null default '';

comment on column public.complaints.resolution_response is
  'Optional resolution or response text added after complaint creation.';

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
          and field_key = 'problem_description'
        limit 1
      ),
      95
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
  'resolution_response',
  'Рішення / Відповідь',
  'textarea'::public.field_type,
  true,
  false,
  true,
  true,
  false,
  true,
  false,
  sort_order
from positions
on conflict (entity_id, field_key) do update set
  label = excluded.label,
  field_type = excluded.field_type,
  is_system = true,
  is_required = false,
  is_active = true,
  is_visible = true,
  show_in_create = false,
  show_in_details = true,
  sort_order = excluded.sort_order;
