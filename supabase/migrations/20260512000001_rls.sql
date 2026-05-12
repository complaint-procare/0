-- Complaint CRM — Row Level Security
-- Strategy:
--   * Read-only access for any authenticated user (so the SPA can list dictionaries).
--   * Mutations gated by role through helper functions.
--   * Service role bypasses RLS automatically (used by Edge Functions / migrations).

-- =========================================================================
-- Helper: current public.users row for the signed-in auth user
-- =========================================================================
create or replace function public.current_app_user()
returns public.users
language sql
stable
security definer
set search_path = public
as $$
  select u.*
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns user_role
language sql
stable
as $$
  select role from public.current_app_user();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in (
    'admin','supervisor','manager','product_manager','qa'
  ), false);
$$;

-- =========================================================================
-- Enable RLS on every public table
-- =========================================================================
alter table public.users                  enable row level security;
alter table public.brands                 enable row level security;
alter table public.products               enable row level security;
alter table public.retail_networks        enable row level security;
alter table public.clients                enable row level security;
alter table public.complaint_statuses     enable row level security;
alter table public.severity_levels        enable row level security;
alter table public.entity_definitions     enable row level security;
alter table public.field_definitions      enable row level security;
alter table public.entity_records         enable row level security;
alter table public.complaints             enable row level security;
alter table public.complaint_attachments  enable row level security;
alter table public.complaint_change_log   enable row level security;
alter table public.app_settings           enable row level security;

-- =========================================================================
-- USERS
-- =========================================================================
create policy users_select on public.users
  for select to authenticated
  using (true);

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================================
-- Dictionaries: any staff can read, admins can write
-- =========================================================================
create policy brands_select on public.brands
  for select to authenticated using (true);
create policy brands_admin_write on public.brands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products
  for select to authenticated using (true);
create policy products_admin_write on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy retail_networks_select on public.retail_networks
  for select to authenticated using (true);
create policy retail_networks_admin_write on public.retail_networks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy clients_select on public.clients
  for select to authenticated using (true);
create policy clients_staff_write on public.clients
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy statuses_select on public.complaint_statuses
  for select to authenticated using (true);
create policy statuses_admin_write on public.complaint_statuses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy severities_select on public.severity_levels
  for select to authenticated using (true);
create policy severities_admin_write on public.severity_levels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- Entity / field builder
-- =========================================================================
create policy entity_definitions_select on public.entity_definitions
  for select to authenticated using (true);
create policy entity_definitions_admin_write on public.entity_definitions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy field_definitions_select on public.field_definitions
  for select to authenticated using (true);
create policy field_definitions_admin_write on public.field_definitions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy entity_records_select on public.entity_records
  for select to authenticated using (true);
create policy entity_records_staff_write on public.entity_records
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- =========================================================================
-- Complaints
--   * All staff read.
--   * Managers can create complaints (created_by set to their public.users.id).
--   * Managers can update their own complaints; supervisors/admin/qa update any.
--   * Closing/deletion of records goes through update; hard delete restricted to admin.
-- =========================================================================
create policy complaints_select on public.complaints
  for select to authenticated
  using (public.is_staff());

create policy complaints_insert on public.complaints
  for insert to authenticated
  with check (
    public.is_staff()
    and created_by = (select id from public.current_app_user())
  );

create policy complaints_update on public.complaints
  for update to authenticated
  using (
    public.is_admin()
    or public.current_user_role() in ('supervisor','qa')
    or manager_id = (select id from public.current_app_user())
  )
  with check (
    public.is_admin()
    or public.current_user_role() in ('supervisor','qa')
    or manager_id = (select id from public.current_app_user())
  );

create policy complaints_delete_admin on public.complaints
  for delete to authenticated
  using (public.is_admin());

-- Attachments
create policy attachments_select on public.complaint_attachments
  for select to authenticated using (public.is_staff());
create policy attachments_insert on public.complaint_attachments
  for insert to authenticated
  with check (
    public.is_staff()
    and uploaded_by = (select id from public.current_app_user())
  );
create policy attachments_update on public.complaint_attachments
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
create policy attachments_delete_admin on public.complaint_attachments
  for delete to authenticated using (public.is_admin());

-- Change log: insert-only for staff; read for staff; no updates/deletes
create policy change_log_select on public.complaint_change_log
  for select to authenticated using (public.is_staff());
create policy change_log_insert on public.complaint_change_log
  for insert to authenticated
  with check (
    public.is_staff()
    and actor_id = (select id from public.current_app_user())
  );

-- =========================================================================
-- App settings
-- =========================================================================
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);
create policy app_settings_admin_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
