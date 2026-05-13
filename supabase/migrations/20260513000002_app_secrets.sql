-- Complaint CRM — server-only secrets store.
-- Only the service role (used by Edge Functions) can read/write.
-- Used for OAuth refresh_tokens etc. that must never reach the browser.

create table public.app_secrets (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.app_secrets enable row level security;

-- No grants for anon/authenticated. Service role bypasses RLS automatically.
revoke all on public.app_secrets from anon, authenticated;
