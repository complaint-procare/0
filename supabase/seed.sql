-- Complaint CRM — initial seed data
-- Only system reference data (statuses, severity levels, entity/field definitions).
-- Business records (users, brands, products, networks, clients) are managed via the app UI.

-- ============================================================
-- Complaint statuses
-- ============================================================
insert into public.complaint_statuses (name, sort_order, color, is_closed, is_active, registry_tint_percent, registry_shadow_enabled) values
  ('Новий',                         10, '#1FC791', false, true,  0, false),
  ('В роботі',                      20, '#D97706', false, true,  0, false),
  ('В роботі виробництво',          30, '#D97706', false, true,  0, false),
  ('В роботі ВКЯ',                  40, '#D97706', false, true,  0, false),
  ('В роботі продакт-менеджер',     50, '#D97706', false, true,  0, false),
  ('Очікує відповідь клієнта',      60, '#7C3AED', false, true,  0, false),
  ('Очікує ВКЯ',                    70, '#7C3AED', false, true,  0, false),
  ('Закрито',                       80, '#000000', true,  true, 10, false),
  ('Відхилено',                     90, '#DC2626', true,  true,  0, false)
on conflict (name) do nothing;

-- ============================================================
-- Severity levels
-- ============================================================
insert into public.severity_levels (name, sort_order, color, is_active) values
  ('Інформаційна', 10, '#64748B', true),
  ('Низька',       20, '#059669', true),
  ('Середня',      30, '#D97706', true),
  ('Висока',       40, '#EA580C', true)
on conflict (name) do nothing;

-- ============================================================
-- Complaint groups
-- ============================================================
insert into public.complaint_groups (name, sort_order, is_active) values
  ('Етикування', 10, true),
  ('Сировина', 20, true),
  ('Комплектуючі', 30, true),
  ('Терміни', 40, true),
  ('Реакція на використання', 50, true),
  ('Логістичні скарги', 60, true),
  ('Інші', 70, true)
on conflict (name) do nothing;

-- Brands, products, retail networks, clients and users are operational data
-- created via the app UI — they must not be seeded here.

-- ============================================================
-- Entity definitions (system entities)
-- ============================================================
insert into public.entity_definitions
  (entity_key, singular_label, plural_label, icon, sort_order,
   show_in_navigation, is_system, is_active, is_visible)
values
  ('complaints',      'Скарга',         'Скарги',         'AlertCircle', 10, true,  true, true, true),
  ('clients',         'Клієнт',         'Клієнти',        'Users',       20, true,  true, true, true),
  ('brands',          'Бренд',          'Бренди',         'Tag',         30, true,  true, true, true),
  ('products',        'Продукт',        'Продукти',       'Package',     40, true,  true, true, true),
  ('retail_networks', 'Торгова мережа', 'Торгові мережі', 'Store',       50, true,  true, true, true),
  ('users',           'Користувач',     'Користувачі',    'UserCog',     60, false, true, true, true)
on conflict (entity_key) do nothing;

-- ============================================================
-- Field definitions for the 'complaints' entity
-- Keep this list aligned with the create/edit/detail UI fields.
-- ============================================================
with e as (select id from public.entity_definitions where entity_key = 'complaints')
insert into public.field_definitions
  (entity_id, field_key, label, field_type,
   is_system, is_required, is_active, is_visible,
   show_in_create, show_in_details, show_in_registry, sort_order)
select e.id, x.field_key, x.label, x.field_type::field_type,
       true, x.is_required, true, true,
       x.show_in_create, x.show_in_details, x.show_in_registry, x.sort_order
from e, (values
  ('number',              'Номер',              'text',      true,  true,  false, true,  10),
  ('created_at',          'Дата створення',     'date',      false, false, true,  true,  20),
  ('created_by',          'Створив',            'reference', false, false, true,  true,  30),
  ('manager_id',          'Менеджер',           'reference', false, false, true,  true,  40),
  ('source_type',         'Тип джерела',        'select',    true,  true,  true,  true,  45),
  ('retail_network_id',   'Торгова мережа',     'reference', false, true,  true,  true,  50),
  ('client_phone',        'Телефон клієнта',    'text',      false, true,  true,  true,  55),
  ('brand_id',            'Бренд',              'reference', true,  true,  true,  true,  60),
  ('product_name',        'Назва продукту',     'text',      true,  true,  true,  true,  70),
  ('product_barcode',     'Штрихкод',           'text',      false, true,  true,  true,  75),
  ('batch_number',        'Номер партії',       'text',      true,  true,  true,  true,  80),
  ('complaint_group_id',  'Група скарги',       'reference', true,  true,  true,  true,  85),
  ('problem_description', 'Суть претензії',     'textarea',  true,  true,  true,  true,  90),
  ('resolution_response', 'Рішення / Відповідь','textarea',  false, false, true,  false, 95),
  ('severity_id',         'Критичність',        'reference', true,  true,  true,  true,  110),
  ('status_id',           'Статус',             'reference', true,  true,  true,  true,  120),
  ('open_action',         'Відкрити',           'text',      false, false, false, true,  130)
) as x(field_key, label, field_type, is_required, show_in_create, show_in_details, show_in_registry, sort_order)
on conflict (entity_id, field_key) do nothing;
