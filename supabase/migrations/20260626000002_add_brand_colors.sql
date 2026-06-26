alter table public.brands
  add column if not exists color text not null default '#64748B';

comment on column public.brands.color is
  'HEX color used by the CRM UI for brand badges.';

update public.brands
set color = '#64748B'
where color = ''
   or color !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$';

notify pgrst, 'reload schema';
