-- Complaint CRM browser persistence.
-- The app uses its own PIN screen, so the browser talks to Supabase with the anon key.
-- These policies make Supabase the persistent data store for that app-level auth model.

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'users',
    'brands',
    'products',
    'retail_networks',
    'clients',
    'complaint_statuses',
    'severity_levels',
    'entity_definitions',
    'field_definitions',
    'entity_records',
    'complaints',
    'complaint_attachments',
    'complaint_change_log',
    'app_settings'
  ]
  loop
    policy_name := table_name || '_anon_all';

    if table_name = 'users' then
      policy_name := 'users_anon_read';
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = policy_name
      ) then
        execute format(
          'create policy %I on public.%I for select to anon using (true)',
          policy_name,
          table_name
        );
      end if;

      policy_name := 'users_anon_write';
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = policy_name
      ) then
        execute format(
          'create policy %I on public.%I for all to anon using (true) with check (true)',
          policy_name,
          table_name
        );
      end if;
    elsif not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all to anon using (true) with check (true)',
        policy_name,
        table_name
      );
    end if;
  end loop;
end $$;
