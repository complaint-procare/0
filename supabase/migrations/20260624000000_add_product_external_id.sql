alter table public.products
  add column if not exists external_id text;

create unique index if not exists products_external_id_uidx
  on public.products (external_id)
  where external_id is not null and external_id <> '';
