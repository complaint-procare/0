-- Denormalized complaint rows for integrations such as Database Webhooks / n8n.
-- One row mirrors one complaint and keeps human-readable fields from related tables.

create table if not exists public.complaint_summary_rows (
  complaint_id      uuid primary key references public.complaints(id) on delete cascade,
  complaint_number  bigint not null,
  complaint_created_at timestamptz not null,
  created_by_id     uuid not null references public.users(id) on delete restrict,
  created_by_name   text not null default '',
  product_name      text not null default '',
  description       text not null default '',
  synced_at         timestamptz not null default now()
);

create index if not exists complaint_summary_rows_created_at_idx
  on public.complaint_summary_rows (complaint_created_at desc);

create index if not exists complaint_summary_rows_created_by_idx
  on public.complaint_summary_rows (created_by_id);

comment on table public.complaint_summary_rows is
  'Auto-synced one-row-per-complaint summary for integrations and webhooks.';
comment on column public.complaint_summary_rows.created_by_name is 'Human-readable complaint creator name.';
comment on column public.complaint_summary_rows.product_name is 'Complaint product name.';
comment on column public.complaint_summary_rows.description is 'Complaint problem description.';

alter table public.complaint_summary_rows enable row level security;

create policy complaint_summary_rows_anon_select
  on public.complaint_summary_rows
  for select to anon
  using (true);

create policy complaint_summary_rows_authenticated_select
  on public.complaint_summary_rows
  for select to authenticated
  using (true);

create or replace function public.sync_complaint_summary_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_name text;
begin
  select coalesce(u.full_name, '')
    into creator_name
  from public.users u
  where u.id = new.created_by;

  insert into public.complaint_summary_rows (
    complaint_id,
    complaint_number,
    complaint_created_at,
    created_by_id,
    created_by_name,
    product_name,
    description,
    synced_at
  )
  values (
    new.id,
    new.number,
    new.created_at,
    new.created_by,
    coalesce(creator_name, ''),
    coalesce(new.product_name, ''),
    coalesce(new.problem_description, ''),
    now()
  )
  on conflict (complaint_id) do update set
    complaint_number = excluded.complaint_number,
    complaint_created_at = excluded.complaint_created_at,
    created_by_id = excluded.created_by_id,
    created_by_name = excluded.created_by_name,
    product_name = excluded.product_name,
    description = excluded.description,
    synced_at = now();

  return new;
end;
$$;

drop trigger if exists complaints_sync_summary_row on public.complaints;
create trigger complaints_sync_summary_row
  after insert or update of number, created_at, created_by, product_name, problem_description
  on public.complaints
  for each row execute function public.sync_complaint_summary_row();

create or replace function public.sync_complaint_summary_rows_user_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.full_name is distinct from new.full_name then
    update public.complaint_summary_rows
    set created_by_name = new.full_name,
        synced_at = now()
    where created_by_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists users_sync_complaint_summary_names on public.users;
create trigger users_sync_complaint_summary_names
  after update of full_name
  on public.users
  for each row execute function public.sync_complaint_summary_rows_user_name();

insert into public.complaint_summary_rows (
  complaint_id,
  complaint_number,
  complaint_created_at,
  created_by_id,
  created_by_name,
  product_name,
  description,
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
  now()
from public.complaints c
left join public.users u on u.id = c.created_by
on conflict (complaint_id) do update set
  complaint_number = excluded.complaint_number,
  complaint_created_at = excluded.complaint_created_at,
  created_by_id = excluded.created_by_id,
  created_by_name = excluded.created_by_name,
  product_name = excluded.product_name,
  description = excluded.description,
  synced_at = now();
