-- Complaint CRM — initial schema
-- Maps src/lib/types.ts → Postgres / Supabase

create extension if not exists "pgcrypto";

-- =========================================================================
-- USERS
-- =========================================================================
create type user_role as enum (
  'manager',
  'supervisor',
  'admin',
  'product_manager',
  'qa'
);

create table public.users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  full_name   text not null,
  role        user_role not null default 'manager',
  pin_hash    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index users_role_idx on public.users (role) where is_active;

-- =========================================================================
-- DICTIONARIES
-- =========================================================================
create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid references public.brands(id) on delete set null,
  name       text not null,
  sku        text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_brand_idx on public.products (brand_id);

create table public.retail_networks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.complaint_statuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_closed  boolean not null default false,
  is_active  boolean not null default true
);

create table public.severity_levels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  color      text not null default '',
  is_active  boolean not null default true
);

-- =========================================================================
-- ENTITY / FIELD BUILDER
-- =========================================================================
create type field_type as enum (
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'select',
  'reference'
);

create table public.entity_definitions (
  id                  uuid primary key default gen_random_uuid(),
  entity_key          text not null unique,
  singular_label      text not null,
  plural_label        text not null,
  icon                text,
  sort_order          int  not null default 0,
  show_in_navigation  boolean not null default true,
  is_system           boolean not null default false,
  is_active           boolean not null default true,
  is_visible          boolean not null default true,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.users(id) on delete set null
);

create table public.field_definitions (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references public.entity_definitions(id) on delete cascade,
  field_key           text not null,
  label               text not null,
  field_type          field_type not null,
  reference_entity_id uuid references public.entity_definitions(id) on delete set null,
  is_system           boolean not null default false,
  is_required         boolean not null default false,
  is_active           boolean not null default true,
  is_visible          boolean not null default true,
  show_in_create      boolean not null default true,
  show_in_details     boolean not null default true,
  show_in_registry    boolean not null default true,
  sort_order          int     not null default 0,
  options             jsonb,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (entity_id, field_key)
);
create index field_definitions_entity_idx on public.field_definitions (entity_id);

create table public.entity_records (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references public.entity_definitions(id) on delete cascade,
  display_name text not null,
  data         jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  is_visible   boolean not null default true,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index entity_records_entity_idx on public.entity_records (entity_id);

-- =========================================================================
-- COMPLAINTS
-- =========================================================================
create type complaint_source as enum ('network', 'client');
create type change_log_event as enum (
  'created',
  'field_updated',
  'status_changed',
  'reopened',
  'file_added',
  'file_deleted'
);

create sequence public.complaint_number_seq start 1;

create table public.complaints (
  id                  uuid primary key default gen_random_uuid(),
  number              bigint not null unique default nextval('public.complaint_number_seq'),
  created_at          timestamptz not null default now(),
  created_by          uuid not null references public.users(id) on delete restrict,
  manager_id          uuid not null references public.users(id) on delete restrict,
  source_type         complaint_source not null default 'network',
  retail_network_id   uuid references public.retail_networks(id) on delete set null,
  client_phone        text not null default '',
  brand_id            uuid references public.brands(id) on delete set null,
  product_name        text not null default '',
  product_barcode     text not null default '',
  batch_number        text not null default '',
  problem_description text not null default '',
  severity_id         uuid references public.severity_levels(id) on delete set null,
  status_id           uuid references public.complaint_statuses(id) on delete set null,
  drive_folder_id     text,
  drive_folder_url    text,
  closed_at           timestamptz,
  updated_at          timestamptz not null default now(),
  custom_fields       jsonb not null default '{}'::jsonb
);
create index complaints_status_idx       on public.complaints (status_id);
create index complaints_brand_idx        on public.complaints (brand_id);
create index complaints_manager_idx      on public.complaints (manager_id);
create index complaints_created_at_idx   on public.complaints (created_at desc);
create index complaints_custom_gin_idx   on public.complaints using gin (custom_fields jsonb_path_ops);

create table public.complaint_attachments (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints(id) on delete cascade,
  drive_file_id text not null,
  drive_url     text not null,
  file_name     text not null,
  mime_type     text not null,
  file_size     bigint not null default 0,
  uploaded_by   uuid references public.users(id) on delete set null,
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references public.users(id) on delete set null
);
create index complaint_attachments_complaint_idx
  on public.complaint_attachments (complaint_id)
  where is_deleted = false;

create table public.complaint_change_log (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id     uuid references public.users(id) on delete set null,
  event_type   change_log_event not null,
  field_name   text,
  old_value    jsonb,
  new_value    jsonb,
  created_at   timestamptz not null default now()
);
create index complaint_change_log_complaint_idx
  on public.complaint_change_log (complaint_id, created_at desc);

-- =========================================================================
-- APP SETTINGS
-- =========================================================================
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

-- =========================================================================
-- TRIGGERS: keep updated_at fresh
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger entity_definitions_set_updated_at
  before update on public.entity_definitions
  for each row execute function public.set_updated_at();

create trigger field_definitions_set_updated_at
  before update on public.field_definitions
  for each row execute function public.set_updated_at();

create trigger entity_records_set_updated_at
  before update on public.entity_records
  for each row execute function public.set_updated_at();

create trigger complaints_set_updated_at
  before update on public.complaints
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
