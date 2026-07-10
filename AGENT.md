# AGENT.md

Локальна технічна пам'ятка для роботи над Complaint CRM.

Актуально станом на **10 липня 2026 року**.

`AGENT.md` відстежується в репозиторії як робоча технічна пам'ятка. Не додавати сюди секрети, токени, приватні ключі або інші значення з `.env.local`.

## 1. Коротко про продукт

Complaint CRM — внутрішній React-застосунок для реєстрації та обробки
скарг споживачів.

Основний сценарій:

1. працівник входить за чотиризначним PIN;
2. створює скаргу від торгової мережі або клієнта;
3. вказує бренд, продукт, партію, групу, критичність, статус і суть;
4. за потреби додає файли;
5. після створення заповнює необов'язкове поле
   **«Рішення / Відповідь»**;
6. зміни потрапляють в історію;
7. реєстр, аналітика та n8n використовують дані Supabase.

Окремий інструмент `/boxes` підбирає транспортну коробку за габаритами товару та використовує каталог `boxes` із fallback на `src/data/boxes.generated.json`.

Telegram не інтегрований у React. Рекомендований потік:

```text
Supabase Database Webhook
  -> n8n
  -> Google Sheets
  -> Telegram
```

## 2. Ключові інваріанти

Не ламати ці правила без окремого архітектурного рішення:

- Supabase є єдиним активним persistence layer;
- локальний IndexedDB/offline fallback вимкнений;
- browser працює з Supabase anon key;
- auth реалізований на рівні застосунку через PIN, не Supabase Auth;
- `service_role` ніколи не потрапляє у frontend;
- файли фізично зберігаються в Google Drive;
- у Supabase зберігаються metadata та Drive links;
- номер скарги генерується Postgres sequence;
- `resolution_response` не показується при створенні;
- `complaint_group_id` обов'язковий у create/edit UI;
- системні форми скарги поки hardcoded, не генеруються з `field_definitions`;
- інтеграції слухають `complaint_summary_rows`, а не raw `complaints`;
- схема, назви колонок, події та семантика `complaint_summary_rows` є
  зафіксованим контрактом чинного n8n workflow;
- `seed.sql` не містить бізнес-даних клієнта;
- активні статуси скарг мають канонічний набір: `Новий`, `В роботі`, `В роботі виробництво`, `В роботі ВКЯ`, `В роботі продакт-менеджер`, `Очікує відповідь клієнта`, `Очікує ВКЯ`, `Закрито`, `Відхилено`;
- legacy-статуси `Нова`, `Закрита`, `Відхилена` remap-ляться міграцією на канонічні назви й не мають повертатися як активні системні значення;
- активні рівні критичності: `Інформаційна`, `Низька`, `Середня`, `Висока`; `Критична` об'єднана з `Висока` і не має повертатися без нової погодженої міграції;
- `products.external_id` — бізнесовий ID із Excel/каталогу, не заміна технічного UUID `products.id`;
- `brands.color` — HEX-колір бренду для `BrandBadge`; дефолт `#64748B`, справжнє збереження потребує міграції `20260626000002_add_brand_colors.sql`;
- `complaint_statuses.registry_tint_percent` (0-100) і `registry_shadow_enabled` керують фоном/тінню рядків і mobile-карток реєстру; `Закрито` за seed/migration має `#000000` і `10%`;
- `complaint_views` рахує унікальні перегляди за `complaint_id` + `user_id`; повторні відкриття тим самим користувачем не збільшують лічильник;
- `.github/workflows/supabase-keepalive.yml` робить легкий щоденний REST-запит для Supabase Free і не змінює бізнес-дані;
- `boxes` є довідником для сторінки `/boxes`; frontend спершу читає Supabase, а при недоступності або порожній таблиці використовує локальний generated JSON.

### Відкладені безпекові зміни

До окремого прямого запиту користувача **не змінювати**:

1. поточну PIN-автентифікацію, browser-сесію, Supabase Auth і пов'язані
   `anon` RLS policies;
2. поточну модель ролей, admin-only навігацію та відсутність окремих
   route-level RBAC guards;
3. поточний захист `upload-attachment` і `google-oauth-callback`, включно з
   `--no-verify-jwt`, OAuth state/nonce, CORS і доступом до Google Drive файлів.

Ці пункти усвідомлено відкладені. Не включати їх у звичайні рефакторинги,
покращення продуктивності або UI. Водночас не приховувати пов'язані ризики
в аналізі, документації або code review. Реалізація можлива лише після
окремого погодження користувача.

## 3. Стек

- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS
- React Router 6
- TanStack Query
- TanStack Table встановлений як dependency, але поточний реєстр його не використовує
- Supabase Postgres
- Supabase Edge Functions / Deno
- Google Drive OAuth
- GitHub Pages
- n8n для зовнішніх інтеграцій

## 4. Основні маршрути

```text
/login
/complaints
/complaints/new
/complaints/:id
/analytics
/boxes

/settings/clients
/settings/brands
/settings/products
/settings/networks
/settings/users
/settings/entities
/settings/fields
/settings/statuses
/settings/general
```

Admin-only navigation:

- users;
- entities;
- fields;
- statuses;
- general.

`App.tsx` захищає весь application shell через `ProtectedRoutes`.
`Layout.tsx` приховує admin-only navigation для неадміністраторів.
Окремого RBAC guard на кожен admin route немає. Прихований пункт меню не
вважати security boundary.

## 5. Структура коду

```text
src/
  App.tsx
    React Router, redirects і protected routes.

  components/
    Layout.tsx
      Desktop sidebar з icon-only collapse, mobile drawer, role-aware navigation.

    SettingsLayout.tsx
      Заголовки сторінок /settings/*.

    Badges.tsx
      StatusBadge, SeverityBadge і BrandBadge.
      Перетворює HEX color у фон/текст бейджа. BrandBadge має окремий compact glass-стиль тільки для колонки бренду.

    admin/
      SimpleCrud.tsx
        Shared CRUD для довідників:
        пошук, сортування, selection, bulk disable/delete,
        active toggle, edit/delete dialogs.

      ProductsExcelImport.tsx
        Імпорт, експорт і шаблон продуктів з Excel.
        Імпорт матчить товари за external_id, потім SKU, потім name+brand.

    boxes/
      BoxesControls.tsx
        Форма введення габаритів товару.

      BoxResultCard.tsx
        Картка знайденої коробки.

      BoxVisual.tsx
        Візуалізація габаритів коробки.

      boxes.css
        Scoped styles сторінки коробок.

    complaints/
      ComplaintFormFields.tsx
        Спільні системні поля create/edit форми скарги.
        Відмінності режимів задаються явними props.

      ComplaintEditor.tsx
        Стан, submit і кнопки редагування скарги.

      ComplaintAttachments.tsx
        Завантаження, прев'ю та дії вкладень.

      ComplaintChangeLog.tsx
        Відображення й форматування історії змін.

      ComplaintRegistryList.tsx
        Desktop table, mobile cards, pagination, open action, resolution copy і status glass реєстру.

      ComplaintRegistryFilters.tsx
        Діалог фільтрів реєстру.

      ComplaintRegistryDialogs.tsx
        Швидка зміна статусу та налаштування колонок.

      registry-types.ts
        Спільні типи, порожні фільтри та fallback-колонки реєстру.

    analytics/
      AnalyticsControls.tsx
        Фільтри й перемикач періоду.

      AnalyticsCharts.tsx
        Картки статистики, графік динаміки та breakdown.

      analytics-calculations.ts
        Чисті функції фільтрації, агрегування та формування серій.

      analytics-types.ts
        Типи даних, періодів і фільтрів аналітики.

    ui/
      primitives.tsx
      autocomplete.tsx
      dialog.tsx
      multi-select.tsx
        Спільний searchable multi-select із chips; використовується в аналітиці та фільтрах реєстру.
      query-state.tsx
        Спільний QueryErrorState з retry та compact режимом.
      source-picker.tsx
      toast.tsx

  lib/
    auth.tsx
      PIN login, session normalization, roles.

    boxes.ts
      Завантаження каталогу коробок із Supabase/fallback JSON і підбір найменшої коробки.

    complaints.ts
      createComplaint, updateComplaint, attachments,
      change log, requestComplaintResend.

    complaint-form.ts
      Спільний стан create/edit форми, перетворення Complaint у форму,
      нормалізація значень і required-валідація.

    db.ts
      list/getById/insert/update/remove/getSetting/upsertSetting.
      Для `brands.color` нормалізує відсутній color до `#64748B` і повторює insert/update без color, якщо Supabase schema cache ще старий. Для `complaint_statuses` нормалізує відсутні registry style поля та повторює insert/update без них, якщо PostgREST schema cache ще не бачить нові колонки.

    seed.ts
      Перевірка Supabase configuration.
      Local seed fallback відсутній.

    supabase.ts
      Browser client і uploadAttachment().

    types.ts
      TypeScript interfaces для таблиць.

    utils.ts
      PIN hashing, date/phone formatting, complaint number.

  pages/
    Login.tsx
    Complaints.tsx
      Завантаження, фільтрація та композиція компонентів реєстру.

    NewComplaint.tsx
    ComplaintDetails.tsx
      Завантаження, загальний layout і координація detail-компонентів.

    Analytics.tsx
      Завантаження даних і композиція analytics-компонентів.

    Boxes.tsx
      Підбір транспортних коробок із `boxes`.

    admin/
      Brands.tsx
      Clients.tsx
      Entities.tsx
      Fields.tsx
      Networks.tsx
      Products.tsx
      Settings.tsx
      Statuses.tsx
      Users.tsx
```

## 6. Auth і ролі

### PIN login

Таблиця:

```text
public.users
```

Поля:

- `id`;
- `full_name`;
- `role`;
- `pin_hash`;
- `is_active`;
- timestamps.

Ролі:

```text
manager
supervisor
admin
product_manager
qa
```

Поточна логіка:

1. PIN має відповідати `/^\d{4}$/`;
2. `hashPin()` рахує детермінований SHA-256 від `complaint-crm:<PIN>`;
3. `legacyHashPin()` підтримує старі записи;
4. при вході legacy hash автоматично замінюється новим;
5. неактивний користувач не входить;
6. сесія пишеться в `localStorage`.

Ключ сесії:

```text
__auth_session__
```

Сесія:

```ts
{
  user_id,
  full_name,
  role,
  signed_in_at
}
```

На старті `normalizeSession()` повторно звіряє користувача з Supabase.

### Важливий security-компроміс

Це application-level auth. Supabase не бачить реального Auth user.
Міграція `20260513000000_pin_app_anon_persistence.sql` відкриває потрібні
таблиці для `anon`.

Для публічного доступу потрібен перехід на Supabase Auth і нові RLS.

### Критичний risk register

Поточну архітектуру не вважати серверно захищеною:

- anon key публічний і має CRUD-доступ до основних таблиць;
- `users.pin_hash` читається через anon, а чотиризначний PIN можна
  перебрати офлайн;
- `localStorage` session і role можна підробити;
- прямі REST-запити обходять React route/navigation checks;
- RPC, що приймають `actor_user_id`, не мають криптографічного доказу
  особи виклику;
- Edge Functions без JWT довіряють browser-supplied identifiers;
- Drive-файли публікуються як `anyone with link`;
- `complaint_summary_rows` і бізнес-дані доступні через anon policies.

До погодженої зміни auth/RLS:

- не називати PIN «надійною автентифікацією»;
- не додавати в застосунок особливо чутливі персональні або медичні дані;
- не відкривати застосунок ширшій аудиторії як production-secure CRM;
- не посилювати хибне відчуття захисту лише приховуванням кнопок у UI;
- при нових таблицях не копіювати широку anon policy без явного аналізу.

## 7. Environment і секрети

### Browser-safe

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_OAUTH_CLIENT_ID
VITE_BASE_PATH
```

Усі `VITE_*` вбудовуються в bundle і вважаються публічними.

### Local/CI only

```text
SUPABASE_PROJECT_REF
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

Ніколи не комітити:

- `.env.local`;
- service role key;
- Supabase access token;
- DB password;
- Google client secret;
- Google refresh token;
- Telegram bot token.

`AGENT.md` не повинен містити реальних секретів.

## 8. Supabase access layer

Frontend client:

```text
src/lib/supabase.ts
```

CRUD layer:

```text
src/lib/db.ts
```

Типові виклики:

```ts
list('complaints')
getById('complaints', id)
insert('products', row)
update('complaints', id, patch)
remove('products', id)
```

Нову таблицю, яку використовує frontend, потрібно:

1. створити міграцією;
2. додати RLS/policies;
3. додати в `Tables` у `src/lib/db.ts`;
4. додати TypeScript interface у `src/lib/types.ts`;
5. за потреби додати seed;
6. застосувати `npx supabase db push`.

## 9. Схема даних

### `users`

PIN-користувачі та ролі.

### `brands`

```text
id
name
color        -- HEX-колір бейджа бренду, default #64748B
is_active
created_at
```

`brands.color` додається міграцією `20260626000002_add_brand_colors.sql`.
Після застосування міграції потрібен reload PostgREST schema cache; міграція містить
`notify pgrst, 'reload schema'`. Fallback у `db.ts` — лише захист від тимчасової
помилки `Could not find the 'color' column`, а не заміна міграції.

### `products`

```text
id              -- технічний UUID primary key
external_id     -- необов'язковий бізнесовий ID товару / ID з Excel
brand_id
name
sku
is_active
created_at
```

`external_id` доданий міграцією `20260624000000_add_product_external_id.sql`.
Якщо значення не порожнє, воно має бути унікальним. У UI колонка називається **ID**.
Не використовувати `external_id` як foreign key: зв’язки всередині бази мають іти через UUID `id`.

### `retail_networks`

Довідник торгових мереж. Нова мережа може створюватись прямо з форми
скарги.

### `clients`

Окремий довідник клієнтів. Поточне джерело `client` у скарзі зберігає
телефон без FK на `clients`.

### `complaint_statuses`

```text
id
name
sort_order
color
is_closed
is_active
```

`is_closed = true` закриває скаргу.

Канонічні активні статуси підтримуються міграцією `20260625000000_normalize_complaint_statuses.sql`:

```text
Новий
В роботі
В роботі виробництво
В роботі ВКЯ
В роботі продакт-менеджер
Очікує відповідь клієнта
Очікує ВКЯ
Закрито
Відхилено
```

Міграція не перетирає наявні HEX-кольори та вимикає legacy-дублікати після remap скарг.

### `severity_levels`

```text
id
name
sort_order
color
is_active
```

Поточні активні рівні:

```text
Інформаційна
Низька
Середня
Висока
```

`Критична` об'єднана з `Висока` міграцією `20260626000000_merge_critical_severity_into_high.sql`.
Міграція переводить `complaints.severity_id` і JSON-значення `complaint_change_log.old_value/new_value` на `Висока`, після чого видаляє рядок `Критична`.

### `complaint_groups`

```text
id
name
sort_order
is_active
created_at
```

Seed values:

```text
Етикування
Сировина
Комплектуючі
Терміни
Реакція на використання
Логістичні скарги
Інші
```

### `complaints`

Основні поля:

```text
id
number
created_at
created_by
manager_id
source_type
retail_network_id
client_phone
brand_id
product_name
product_barcode
batch_number
complaint_group_id
problem_description
resolution_response
severity_id
status_id
drive_folder_id
drive_folder_url
closed_at
updated_at
custom_fields
```

`complaint_group_id` nullable на рівні БД для backward compatibility,
але required у create/edit UI. Міграція груп backfill-ить старі записи
значенням **«Інші»**.

`resolution_response`:

- `text not null default ''`;
- не показується в `NewComplaint`;
- показується в деталях;
- редагується як необов'язковий textarea;
- може бути колонкою реєстру;
- входить у текстовий пошук;
- логуються зміни.

### `complaint_attachments`

Metadata Google Drive:

```text
complaint_id
drive_file_id
drive_url
file_name
mime_type
file_size
uploaded_by
is_deleted
created_at
deleted_at
deleted_by
```

### `complaint_change_log`

Події:

```text
created
field_updated
status_changed
reopened
file_added
file_deleted
```

### `complaint_summary_rows`

Денормалізована webhook-таблиця:

```text
complaint_id
complaint_number
complaint_created_at
created_by_id
created_by_name
product_name
description
resend_requested_at
synced_at
```

### Metadata builder

```text
entity_definitions
field_definitions
entity_records
```

Важливо:

- `field_definitions.show_in_registry` реально керує реєстром;
- `sort_order` задає порядок колонок;
- `show_in_create` і `show_in_details` зберігаються, але не будують
  основні форми автоматично;
- custom field values читаються з `complaints.custom_fields` лише для
  fallback render у реєстрі;
- повного dynamic complaint form builder поки немає.

### Settings

```text
app_settings
app_secrets
```

`app_settings` доступний browser-клієнту.
`app_secrets` читається тільки service role в Edge Functions.

## 10. Створення скарги

Файл:

```text
src/pages/NewComplaint.tsx
```

Завантажувані lookup-и:

- brands;
- products;
- retail networks;
- statuses;
- severity levels;
- complaint groups;
- users.

Required validation:

- network name для `source_type = network`;
- валідний телефон для `source_type = client`;
- brand;
- product name;
- batch number;
- complaint group;
- problem description;
- severity;
- status.

`manager_id` і `created_by` для нової скарги — поточний actor.

`resolution_response` при create завжди записується як порожній рядок.

### SourcePicker

`source_type`:

```text
network
client
```

Network mode:

- autocomplete existing networks;
- manual new name;
- нормалізація пробілів;
- case-insensitive duplicate matching;
- insert new network before complaint insert.

Client mode:

- UI показує `+380`;
- suffix повинен мати дев'ять цифр;
- зберігається повний номер.

### Product autocomplete

- показує тільки активні продукти;
- фільтрується за brand;
- може підставити brand і SKU;
- дозволяє free text;
- при несумісній зміні brand очищає product/SKU.

### Files before create

Файли зберігаються в локальному state до submit. Після створення
`createComplaint()` послідовно викликає `addAttachment()`.

## 11. Деталі та редагування

Файл:

```text
src/pages/ComplaintDetails.tsx
```

Показує:

- основні поля;
- групу скарги;
- суть претензії;
- рішення/відповідь;
- статус і критичність;
- вкладення;
- change log.

EditForm використовує ту саму required-валідацію для ключових полів.
Поточне неактивне значення статусу/критичності/групи залишається доступним
для старої скарги.

Create та edit використовують спільні `ComplaintFormState`,
`validateComplaintForm()`, `normalizeComplaintForm()` і
`ComplaintFormFields`. Режим створення дозволяє нову торгову мережу; режим
редагування додатково показує менеджера та `resolution_response`.

Закритий статус:

- забороняє редагування;
- забороняє зміну вкладень;
- дозволяє reopen;
- reopen логуються окремою подією.

`FIELD_LABELS` і `formatValue()` потрібно оновлювати при додаванні нового
system field, щоб change log показував людську назву та reference label.

## 12. Статуси, критичність і групи

Файл:

```text
src/pages/admin/Statuses.tsx
```

Три вкладки:

```text
Статуси скарг
Критичність
Групи скарг
```

### Status CRUD

- name;
- HEX color;
- sort order;
- registry tint percent (`registry_tint_percent`, 0-100);
- registry shadow toggle (`registry_shadow_enabled`);
- active;
- closes complaint.

Не додавати нові активні варіанти системних статусів без перевірки аналітики, reopen flow,
change log, seed і n8n expectations. Назва статусу все ще використовується частиною UI/analytics як семантичний маркер.

### Severity CRUD

- name;
- HEX color;
- sort order;
- active.

Не повертати `Критична` простим додаванням рядка в UI: якщо бізнес знову захоче окремий рівень,
потрібна нова міграція з backfill/semantics і перевіркою історії змін.

### Group CRUD

- name;
- sort order;
- active.

Використовується `SimpleCrud`.

Delete guard:

- статус не видаляється, якщо є `complaints.status_id`;
- критичність не видаляється, якщо є `complaints.severity_id`;
- група не видаляється, якщо є `complaints.complaint_group_id`;
- замість delete користувачу пропонується deactivate.

Active filter:

- create показує тільки active;
- edit показує active плюс поточне значення;
- історичні записи не втрачають label.

Color validation:

```text
#RGB
#RRGGBB
```

## 13. Реєстр

Файл:

```text
src/pages/Complaints.tsx
```

Заголовок сторінки **`Oops!`** є навмисним продуктовим текстом. Не «виправляти» його на «Реєстр скарг».

`PAGE_SIZE = 50`.

### Data query

Query key:

```text
['complaints-page']
```

Завантажує:

- complaints;
- statuses;
- severities;
- groups;
- brands;
- networks;
- users;
- attachments;
- viewCounts через `getComplaintViewCounts()`;
- entity definitions;
- field definitions.

### Фільтри

```text
statusIds
severityIds
groupIds
brandIds
networkIds
sourceTypes
managerIds
from
to
search
```

Довідникові фільтри в реєстрі є масивами та керуються `MultiSelect`. Якщо обрано тільки `client` у `sourceTypes`, `networkIds` очищається та контрол мереж блокується.

### Пошук

Haystack:

- padded complaint number;
- batch number;
- complaint group name;
- product name;
- barcode;
- client phone;
- problem description;
- resolution response.

### Статуси та перегляди

- статуси в реєстрі клікабельні та відкривають confirmation dialog;
- status tint/shadow застосовується класом `.registry-status-glass` до всіх `td` desktop-рядка та до mobile `Card`;
- `resolution_response` у реєстрі рендериться зі скороченим текстом і copy-кнопкою;
- `open_action` є системною movable колонкою з кнопкою **«Відкрити»**, desktop header прихований через `sr-only`;
- `ComplaintDetails` викликає `recordComplaintView(complaintId, session.user_id)`;
- лічильник унікальних переглядів показується в реєстрі з іконкою ока;
- після запису перегляду інвалідовується `complaints-page`.

### Колонки

Спочатку беруться активні `field_definitions` для `complaints`:

```text
is_active
is_visible
show_in_registry
not deleted_at
```

Якщо metadata немає, використовується `DEFAULT_REGISTRY_FIELDS`.

Admin dialog **«Колонки»**:

- toggle visibility;
- move left/right;
- зберігає `sort_order` кроком 10;
- інвалідовує `complaints-page` і `field_definitions`.

## 14. Аналітика

Файл:

```text
src/pages/Analytics.tsx
```

Query key:

```text
['analytics-data']
```

Periods:

```text
day
week
month
```

Multi-select filters:

- brands;
- product names;
- statuses;
- severity levels;
- retail networks;
- managers.

Outputs:

- total/open/in progress/closed cards;
- period bar chart;
- breakdown by status;
- breakdown by brand.

Групи скарг поки не додані в Analytics filters або breakdown.
Не документувати їх як analytics feature, доки код не змінено.

## 15. Change log

`updateComplaint()`:

1. читає поточну скаргу;
2. застосовує patch;
3. порівнює old/new;
4. записує `field_updated` або `status_changed`;
5. оновлює `closed_at` для closed status;
6. при reopen очищає `closed_at`.

При новому system field перевірити:

- `Complaint` type;
- create input;
- create insert;
- detail display;
- edit form/state/patch;
- `FIELD_LABELS`;
- reference lookup map;
- registry fallback field;
- seed field definition;
- migration field definition.

## 16. Google Drive

### OAuth callback

```text
supabase/functions/google-oauth-callback/index.ts
```

Зберігає:

```text
app_secrets:
  key = drive.oauth
  refresh_token
  root_folder_id

app_settings:
  key = drive.connection
  connected
  email
  folder_name
  folder_id
  connected_at
```

### Upload

```text
supabase/functions/upload-attachment/index.ts
```

Алгоритм:

1. validate complaint/user/file;
2. перевірити active user;
3. прочитати `drive.oauth`;
4. refresh Google access token;
5. знайти/створити `complaint-<number>`;
6. upload;
7. set public reader permission;
8. update complaint folder metadata;
9. insert attachment metadata;
10. повернути metadata у frontend;
11. frontend окремим запитом записує `file_added` у change log.

Якщо upload у Drive або insert metadata частково завершився з помилкою,
можливі orphan-файли чи неповний audit log. Видалення вкладення в поточному
frontend лише ставить `is_deleted`; фізичний Drive-файл не видаляється.

Обидві Edge Functions деплояться з `--no-verify-jwt`.

## 17. Summary table і n8n

Інтеграції мають слухати:

```text
public.complaint_summary_rows
```

Події:

```text
Insert
Update
```

Trigger-и синхронізують summary:

- після insert/update complaints;
- після зміни `users.full_name`;
- після ручного RPC resend.

Кнопка **«Оновити»** у деталях:

```ts
requestComplaintResend(complaintId)
```

Викликає:

```text
public.request_complaint_resend(uuid)
```

Під час створення нової скарги з файлами `NewComplaint.tsx` після завершення
всіх початкових upload-ів автоматично викликає `requestComplaintResend()`.
Це навмисний сигнал для n8n: `resend_requested_at` має змінитися вже після
появи metadata у `complaint_attachments`.

`complaint_summary_rows` є інтеграційним контрактом, який уже
використовується в n8n. Без окремого погодження та одночасного оновлення
n8n workflow не змінювати:

- назву таблиці;
- набір, назви та значення колонок;
- `Insert`/`Update` webhook events;
- trigger-и синхронізації;
- RPC повторної відправки;
- semantics `resend_requested_at`.

Frontend-рефакторинги не повинні торкатися цієї таблиці, її міграцій,
trigger-ів або RPC.

## 18. Нумерація

```text
public.complaint_number_seq
```

Frontend не передає `number` при create.

Не повертати логіку `max(number) + 1` у React: вона створює race condition.

Міграції керування counter:

```text
20260530000000_complaint_number_counter_admin.sql
20260530000001_restrict_counter_reset_rpc.sql
20260530000002_counter_called_state.sql
```

## 19. Міграції

Не редагувати вже застосовані міграції для нової поведінки.
Створювати новий timestamped SQL файл.

Поточні важливі останні зміни:

```text
20260603000000_status_and_severity_colors.sql
20260615000000_add_complaint_resolution_response.sql
20260615000001_add_complaint_groups.sql
20260623000000_add_complaint_unique_views.sql
20260624000000_add_product_external_id.sql
20260625000000_normalize_complaint_statuses.sql
20260626000000_merge_critical_severity_into_high.sql
20260706000000_add_boxes.sql
20260709000001_add_status_registry_style.sql
```

Для нової таблиці:

- create table;
- indexes;
- enable RLS;
- authenticated policies, якщо потрібні;
- anon policy для поточної PIN-архітектури;
- seed data, якщо це system dictionary;
- TypeScript table mapping.

Для нового complaint field:

- add column;
- index для reference/filter fields;
- backfill strategy;
- FK delete behavior;
- `field_definitions` insert/update;
- seed alignment;
- UI/type/change log/registry.

Після schema change:

```bash
npx supabase db push
```

## 20. Seed

```text
supabase/seed.sql
```

Дозволено:

- complaint statuses;
- severity levels;
- complaint groups;
- system entity definitions;
- system field definitions.

Заборонено:

- реальні users;
- brands;
- products;
- retail networks;
- clients;
- complaints;
- OAuth tokens.

Seed має бути idempotent через `on conflict`.

Поточний seed довідників створює:

- 9 канонічних статусів скарг;
- 4 рівні критичності без `Критична`;
- базові групи скарг.

Якщо змінюється системний довідник, оновити одночасно migration, seed, README, AGENT і, якщо пункт уже не майбутній, FUTURE.

## 21. Query invalidation

Після mutation не забувати інвалідовувати релевантні keys.

Типові:

```text
['complaints-page']
['complaint', id]
['lookup-data']
['analytics-data']
['complaint_statuses']
['severity_levels']
['complaint_groups']
['field_definitions']
['products']
['brands']
['app_setting', 'drive.connection']
```

`SimpleCrud` інвалідовує query key, рівний table name.

## 22. Цілісність, конкурентність і масштабування

Поточні data-flow обмеження:

- `createComplaint()` окремо вставляє скаргу, event `created` і кожен файл;
- `updateComplaint()` окремо оновлює row і потім пише events;
- direct REST/SQL updates не створюють повний change log;
- паралельні редактори не перевіряють версію `updated_at`;
- реєстр завантажує всі complaints/attachments і пагінує в пам'яті;
- `getChangeLog()` і `getAttachments()` спочатку завантажують цілі таблиці;
- Analytics завантажує всі complaints і рахує агрегати в браузері.
- Boxes завантажує каталог коробок із Supabase або fallback JSON і рахує підбір у браузері.

Не маскувати ці проблеми локальною оптимізацією React. Для реального
масштабування потрібні server-side range/count/filter queries, а для
атомарності — RPC або database triggers.

## 23. Local run і перевірки

```bash
npm install
npm run dev
npm run lint
npm run build
npm run check:supabase
```

Перед завершенням frontend task:

1. `git diff --check`;
2. `npm run build`;
3. відкрити relevant route в browser;
4. перевірити desktop/mobile layout, якщо змінювався UI;
5. перевірити console errors;
6. `git status`.

На Windows у sandbox Vite/esbuild часто падає:

```text
Error: spawn EPERM
```

Якщо TypeScript-частина пройшла, повторити `npm run build` поза sandbox.

### Query error states

Для React Query екранів використовувати `QueryErrorState` з
`src/components/ui/query-state.tsx`.

Правила:

- початкова помилка без `data` замінює loading/empty state;
- `isRefetchError` за наявності `data` показує compact warning, але не
  приховує останні успішні дані;
- retry викликає `refetch`;
- `isFetching` блокує повторну кнопку й показує spinner;
- не показувати empty state, якщо запит завершився помилкою.

## 24. Deploy

### Frontend

```text
.github/workflows/deploy.yml
```

Push у `main`:

- npm ci;
- env validation;
- `VITE_BASE_PATH=/<repo>/`;
- npm run build;
- GitHub Pages deploy.

### Supabase keepalive

```text
.github/workflows/supabase-keepalive.yml
```

Запускається щодня опівночі Europe/Kyiv і робить read-only REST-запит до `complaints?select=id&limit=1`.
Потрібні repository variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
Не переносити в цей workflow service role key і не робити destructive SQL.

### Supabase

```text
.github/workflows/supabase-migrate.yml
```

Тригери:

- migrations;
- functions;
- seed;
- workflow.

Pipeline:

- link;
- db push;
- seed;
- set OAuth secrets;
- deploy both functions.

Local:

```bash
npm run deploy:supabase
```

### Локальні operational links

- Supabase Dashboard:
  https://supabase.com/dashboard/project/ihjvjwzomrbyitubovsg
- Google Cloud credentials:
  https://console.cloud.google.com/apis/credentials?project=complaints-496120
- Google OAuth audience:
  https://console.cloud.google.com/auth/audience

Ці URL не є секретами, але не дублювати їх у публічному README без потреби.

## 25. Git і локальні файли

Перед commit:

- не використовувати `git add .`, якщо є сторонні untracked файли;
- stage явний список файлів;
- не stage `AGENT.md`;
- не stage `.claude/worktrees/`;
- не stage `docs/report/`, якщо користувач прямо не просив;
- не stage `.env.local` або `secrets.local.md`.

Поточні локальні untracked каталоги можуть належати користувачу.
Не видаляти й не переносити їх без прямого запиту.

Коли користувач пише **«запуш»**:

1. перевірити status;
2. stage тільки релевантні файли;
3. commit із конкретним message;
4. push поточної branch;
5. повідомити commit SHA;
6. згадати залишкові untracked файли.

## 26. Правила редагування

- Спочатку читати існуючий pattern.
- Для пошуку використовувати `rg`.
- Для ручних змін використовувати `apply_patch`.
- Не переписувати unrelated code.
- Не revert-ити user changes.
- Не редагувати стару migration замість нової.
- Не створювати окремий API layer без потреби: поточний pattern — `db.ts`.
- Для dictionary CRUD використовувати `SimpleCrud`, якщо поведінка підходить.
- Для нових UI controls використовувати локальні primitives.
- Тексти UI — українською.
- Кольори статусів/критичності — валідні HEX.
- Не додавати dynamic abstraction, якщо hardcoded system field простіший і
  відповідає поточній архітектурі.
- Не описувати soft delete вкладення як фізичне видалення з Google Drive.
- Не стверджувати, що change log повний або атомарний.
- Не використовувати назву статусу як новий системний ідентифікатор.
- Glass/key-стиль `BrandBadge` не переносити на глобальні `.btn`: кнопки мають лишатися у своєму поточному стилі, якщо користувач окремо не попросив змінити всі кнопки.
- Для небезпечних bulk/import дій спочатку оцінювати транзакційність,
  preview і можливість відновлення.

## 27. Checklist для типових змін

### Нове поле скарги

- [ ] migration column
- [ ] field definition migration
- [ ] seed field definition
- [ ] `Complaint` type
- [ ] create input/insert, якщо поле є при create
- [ ] NewComplaint UI/validation
- [ ] ComplaintDetails display/edit
- [ ] change log label/lookup
- [ ] registry render/search/filter
- [ ] analytics, якщо потрібно
- [ ] summary table/n8n, якщо потрібно
- [ ] build і browser verification
- [ ] README та AGENT

### Новий довідник

- [ ] table
- [ ] RLS/policies
- [ ] seed defaults
- [ ] TypeScript type
- [ ] `db.ts` table mapping
- [ ] settings CRUD
- [ ] active behavior
- [ ] delete guard
- [ ] forms
- [ ] filters/search
- [ ] migration push
- [ ] docs

### Зміна webhook behavior

- [ ] summary schema
- [ ] sync triggers
- [ ] resend RPC
- [ ] n8n Insert/Update assumptions
- [ ] README/AGENT

### Нова mutation або RPC

- [ ] серверна авторизація або явне документування її відсутності
- [ ] transaction/partial-failure behavior
- [ ] idempotency/retry behavior
- [ ] audit log
- [ ] concurrent update behavior
- [ ] user-facing error state
- [ ] integration/unit test

## 28. Відомі компроміси

- PIN-auth замість server-issued auth session.
- Статичний namespace hash і простір лише з 10 000 PIN.
- Anon CRUD policies, включно з читанням PIN hashes і бізнес-даних.
- Немає окремого route-level або server-side authorization для admin pages.
- Edge Functions без JWT verification та без server-side admin session.
- Google Drive public link permission для preview.
- Soft delete metadata не очищає Drive.
- Complaint update і audit log не атомарні.
- Немає optimistic locking для одночасного редагування.
- Валідація ключових complaint invariants переважно client-side.
- Client-side pagination/filtering/analytics, підбір коробок і full-table detail helpers.
- Немає automated tests і перевіреного backup/restore процесу.
- OAuth Testing refresh token може протухати.
- Metadata flags create/details не генерують форми.
- Analytics ще не має complaint group filter.
- Analytics для частини карток все ще використовує name-based lookup статусів, зокрема `Новий`/legacy `Нова` та `В роботі`; потрібні незмінні системні коди статусів.
- Analytics card value і delta мають різні часові межі.
- `check:supabase` робить базову, а не повну schema validation.
- Excel import продуктів не є транзакційним batch-оновленням: часткова помилка може залишити вже створені/оновлені товари. Перед destructive import бажано робити експорт.
- Унікальні перегляди прив’язані до поточного `session.user_id` з browser PIN-сесії, тому мають ті самі security-обмеження, що й решта PIN-архітектури.
- Історична Supabase Storage migration залишається в migration history,
  але активні вкладення йдуть у Google Drive.
