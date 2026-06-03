alter table public.complaint_statuses
  add column if not exists color text not null default '#64748B';

alter table public.severity_levels
  alter column color set default '#64748B';

comment on column public.complaint_statuses.color is
  'HEX color used by the CRM UI for status badges.';

comment on column public.severity_levels.color is
  'HEX color used by the CRM UI for severity badges.';

update public.complaint_statuses
set color = case name
  when 'Нова' then '#2563EB'
  when 'В роботі' then '#D97706'
  when 'Очікує відповідь клієнта' then '#0891B2'
  when 'Очікує ВКЯ' then '#7C3AED'
  when 'Закрита' then '#059669'
  when 'Відхилена' then '#DC2626'
  else coalesce(nullif(color, ''), '#64748B')
end
where color = '#64748B' or color = '';

update public.severity_levels
set color = case name
  when 'Інформаційна' then '#64748B'
  when 'Низька' then '#059669'
  when 'Середня' then '#D97706'
  when 'Висока' then '#EA580C'
  when 'Критична' then '#DC2626'
  else '#64748B'
end
where color = ''
   or color like 'bg-%'
   or color !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$';
