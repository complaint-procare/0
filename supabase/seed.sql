-- Complaint CRM — initial seed data
-- Mirrors src/lib/seed.ts so a fresh Supabase project is immediately usable.
-- PINs are SHA-256 hashes (lowercase hex), matching src/lib/utils.ts → hashPin.

-- ============================================================
-- Users
-- ============================================================
insert into public.users (full_name, role, pin_hash, is_active)
values
  ('Адмін Адмінович',  'admin',           encode(digest('1234','sha256'),'hex'), true),
  ('Ірина Менеджер',   'manager',         encode(digest('1111','sha256'),'hex'), true),
  ('Олег Керівник',    'supervisor',      encode(digest('2222','sha256'),'hex'), true),
  ('Марія Продакт',    'product_manager', encode(digest('3333','sha256'),'hex'), true),
  ('Тарас ВКЯ',        'qa',              encode(digest('4444','sha256'),'hex'), true)
on conflict do nothing;

-- ============================================================
-- Complaint statuses
-- ============================================================
insert into public.complaint_statuses (name, sort_order, is_closed, is_active) values
  ('Нова',                       10, false, true),
  ('В роботі',                   20, false, true),
  ('Очікує відповідь клієнта',   30, false, true),
  ('Очікує ВКЯ',                 40, false, true),
  ('Закрита',                    50, true,  true),
  ('Відхилена',                  60, true,  true)
on conflict (name) do nothing;

-- ============================================================
-- Severity levels
-- ============================================================
insert into public.severity_levels (name, sort_order, color, is_active) values
  ('Інформаційна', 10, 'bg-slate-700/40 text-slate-300', true),
  ('Низька',       20, 'bg-emerald-900/40 text-emerald-400', true),
  ('Середня',      30, 'bg-amber-900/40 text-amber-400', true),
  ('Висока',       40, 'bg-orange-900/40 text-orange-400 ring-1 ring-orange-700/50', true),
  ('Критична',     50, 'bg-red-900/40 text-red-400 ring-1 ring-red-700/50', true)
on conflict (name) do nothing;

-- ============================================================
-- Brands / products / retail networks / clients
-- ============================================================
insert into public.brands (name, is_active) values
  ('Joko Blend', true),
  ('Skin Lab',   true),
  ('Daily Care', true)
on conflict (name) do nothing;

insert into public.products (brand_id, name, sku, is_active)
select b.id, p.name, p.sku, true from (values
  ('Joko Blend', 'Кавовий скраб',            'JB-CSCR-200'),
  ('Joko Blend', 'Молочко для тіла',         'JB-BMLK-250'),
  ('Skin Lab',   'Сироватка з вітаміном C',  'SL-SERC-30'),
  ('Daily Care', 'Крем для рук',             'DC-HCR-75')
) as p(brand_name, name, sku)
join public.brands b on b.name = p.brand_name
on conflict do nothing;

insert into public.retail_networks (name, is_active) values
  ('EVA',     true),
  ('Watsons', true),
  ('Prostor', true),
  ('Rozetka', true)
on conflict (name) do nothing;

insert into public.clients (name, contact_person, phone, is_active) values
  ('Тестовий клієнт', 'Іван Іванович', '+380501112233', true)
on conflict do nothing;

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
-- (mirrors sysField() calls in src/lib/seed.ts)
-- ============================================================
with e as (select id from public.entity_definitions where entity_key = 'complaints')
insert into public.field_definitions
  (entity_id, field_key, label, field_type,
   is_system, is_required, is_active, is_visible,
   show_in_create, show_in_details, show_in_registry, sort_order)
select e.id, x.field_key, x.label, x.field_type::field_type,
       true, x.is_required, true, true,
       x.show_in_create, x.show_in_details, true, x.sort_order
from e, (values
  ('number',              'Номер',              'text',      true,  true,  false, 10),
  ('created_at',          'Дата створення',     'date',      false, false, true,  20),
  ('created_by',          'Створив',            'reference', false, false, true,  30),
  ('manager_id',          'Менеджер',           'reference', false, false, true,  40),
  ('source_type',         'Тип джерела',        'select',    true,  true,  true,  45),
  ('retail_network_id',   'Торгова мережа',     'reference', false, true,  true,  50),
  ('client_phone',        'Телефон клієнта',    'text',      false, true,  true,  55),
  ('brand_id',            'Бренд',              'reference', true,  true,  true,  60),
  ('product_name',        'Назва продукту',     'text',      true,  true,  true,  70),
  ('product_barcode',     'Штрихкод',           'text',      false, true,  true,  75),
  ('batch_number',        'Номер партії',       'text',      true,  true,  true,  80),
  ('problem_description', 'Суть претензії',     'textarea',  true,  true,  true,  90),
  ('severity_id',         'Критичність',        'reference', true,  true,  true,  110),
  ('status_id',           'Статус',             'reference', true,  true,  true,  120)
) as x(field_key, label, field_type, is_required, show_in_create, show_in_details, sort_order)
on conflict (entity_id, field_key) do nothing;

-- ============================================================
-- App settings
-- ============================================================
insert into public.app_settings (key, value) values
  ('drive.base_folder', '{"name":"Complaints","enabled":false}'::jsonb)
on conflict (key) do nothing;
