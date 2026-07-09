alter table public.complaint_statuses
  add column if not exists registry_tint_percent integer not null default 0,
  add column if not exists registry_shadow_enabled boolean not null default false;

comment on column public.complaint_statuses.registry_tint_percent is
  'Percent opacity used to tint complaint registry rows/cards with the status color.';

comment on column public.complaint_statuses.registry_shadow_enabled is
  'Enables an additional registry row/card shadow based on the status color.';

update public.complaint_statuses
set registry_tint_percent = 10
where name = 'Закрито'
  and registry_tint_percent = 0;