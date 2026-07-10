# Complaint CRM

Внутрішній вебзастосунок для реєстрації, обробки та аналізу скарг споживачів.

Актуальний стан документації: **10 липня 2026 року**.

## Основні можливості

- вхід працівників за чотиризначним PIN;
- створення скарги від торгової мережі або клієнта за телефоном;
- вибір бренду, продукту, номера партії, групи скарги, критичності та статусу;
- довідник брендів із налаштовуваним HEX-кольором для бейджа в колонці **«Бренд»**;
- текстове поле **«Рішення / Відповідь»**, яке з'являється після створення скарги;
- вкладення фото, відео й інших файлів у Google Drive;
- реєстр із пошуком, множинними фільтрами, налаштовуваними колонками, пагінацією, лічильником вкладень і унікальних переглядів;
- desktop-меню згортається до icon-only режиму та запам'ятовує стан локально;
- статуси можуть підфарбовувати весь рядок або мобільну картку реєстру з відсотком прозорості, тінню та легким glass-ефектом;
- клікабельна зміна статусу з підтвердженням без окремої колонки «Змінити статус»;
- копіювання тексту **«Рішення / Відповідь»** у реєстрі через іконку біля тексту;
- історія змін полів, статусів і вкладень;
- аналітика за періодом, статусами, брендами та іншими фільтрами;
- вкладка **«Коробки»** під аналітикою: підбір транспортної коробки за габаритами товару;
- каталог продуктів із необов'язковим товарним ID, пошуком за назвою/ID/SKU та імпортом/експортом Excel;
- адміністрування користувачів, довідників, полів і Google Drive OAuth;
- денормалізована таблиця для Supabase Database Webhooks, n8n, Google Sheets і Telegram;
- щоденний keepalive-запит GitHub Actions для Supabase Free.

## Стек

- **Frontend:** React 18, Vite 5, TypeScript, React Router 6
- **UI:** Tailwind CSS, Lucide React, локальні UI-примітиви
- **Дані:** TanStack Query; реєстр побудований на звичайній HTML-таблиці
- **Backend:** Supabase Postgres, RLS, RPC, тригери
- **Serverless:** Supabase Edge Functions на Deno
- **Файли:** Google Drive OAuth
- **Auth:** browser-only PIN-вхід без Supabase Auth; не є серверною межею доступу
- **Frontend deploy:** GitHub Pages
- **Backend deploy:** Supabase CLI та GitHub Actions

## Структура проєкту

```text
src/
  App.tsx                       маршрути застосунку
  components/
    Layout.tsx                  desktop/mobile shell, навігація, згортання desktop sidebar
    SettingsLayout.tsx          заголовки сторінок /settings/*
    Badges.tsx                  кольорові StatusBadge / SeverityBadge / BrandBadge
    admin/
      SimpleCrud.tsx            спільний CRUD довідників
      ProductsExcelImport.tsx   імпорт, експорт і шаблон продуктів з Excel
    analytics/
      AnalyticsControls.tsx     фільтри та перемикач періоду
      AnalyticsCharts.tsx       картки, графік і breakdown
      analytics-calculations.ts чисті функції аналітики
      analytics-types.ts        типи аналітики
    boxes/
      BoxesControls.tsx         форма введення габаритів товару
      BoxResultCard.tsx         картка рекомендованої коробки
      BoxVisual.tsx             візуалізація розміру коробки
      boxes.css                 стилі сторінки коробок
    complaints/
      ComplaintFormFields.tsx   спільні поля create/edit форми
      ComplaintEditor.tsx       редактор скарги
      ComplaintAttachments.tsx  вкладення
      ComplaintChangeLog.tsx    історія змін
      ComplaintRegistryList.tsx список, пагінація, open action, copy та status glass реєстру
      ComplaintRegistryFilters.tsx
      ComplaintRegistryDialogs.tsx
      registry-types.ts
    ui/
      autocomplete.tsx
      dialog.tsx
      multi-select.tsx
      primitives.tsx
      query-state.tsx             помилка запиту та повторне завантаження
      source-picker.tsx
      toast.tsx
  lib/
    auth.tsx                    PIN-сесія, useAuth(), ролі
    boxes.ts                    завантаження та підбір коробок
    complaint-form.ts           стан, нормалізація і валідація форми
    complaints.ts               створення/оновлення скарг, вкладення, лог
    db.ts                       типізовані CRUD-обгортки Supabase і fallback для старого schema cache
    supabase.ts                 browser client і uploadAttachment()
    types.ts                    моделі таблиць Postgres
    utils.ts                    форматування, PIN hash, номер скарги
  data/
    boxes.generated.json        fallback-каталог коробок із BOX
  pages/
    Login.tsx
    Complaints.tsx              реєстр, фільтри, колонки, пагінація
    NewComplaint.tsx            створення скарги
    ComplaintDetails.tsx        деталі, редагування, файли, історія
    Analytics.tsx
    Boxes.tsx                   підбір транспортних коробок
    admin/
      Brands.tsx
      Clients.tsx
      Entities.tsx
      Fields.tsx
      Networks.tsx
      Products.tsx
      Settings.tsx              Google Drive OAuth
      Statuses.tsx              статуси, registry tint/shadow, критичність, групи скарг
      Users.tsx
supabase/
  migrations/                   схема, RLS, RPC, тригери й зміни полів
  seed.sql                      тільки системні довідники та metadata
  functions/
    upload-attachment/
    google-oauth-callback/
scripts/
  check-supabase.mjs
  create-admin.mjs
  create-spa-route-pages.mjs
  deploy-supabase.mjs
.github/workflows/
  deploy.yml
  supabase-migrate.yml
  supabase-keepalive.yml
```

## Маршрути та доступ

| Маршрут | Призначення | Доступ |
|---|---|---|
| `/login` | PIN-вхід | усі |
| `/complaints` | реєстр скарг | авторизовані |
| `/complaints/new` | створення скарги | авторизовані |
| `/complaints/:id` | деталі й редагування | авторизовані |
| `/analytics` | аналітика | авторизовані |
| `/boxes` | підбір транспортних коробок | авторизовані |
| `/settings/clients` | клієнти | авторизовані |
| `/settings/brands` | бренди | авторизовані |
| `/settings/products` | продукти | авторизовані |
| `/settings/networks` | торгові мережі | авторизовані |
| `/settings/users` | користувачі та PIN | PIN-сесія; у меню лише admin |
| `/settings/entities` | конструктор сутностей | PIN-сесія; у меню лише admin |
| `/settings/fields` | metadata полів | PIN-сесія; у меню лише admin |
| `/settings/statuses` | статуси, критичність, групи | PIN-сесія; у меню лише admin |
| `/settings/general` | Google Drive OAuth | PIN-сесія; у меню лише admin |

`Layout.tsx` приховує admin-пункти від інших ролей, але окремого
route-level RBAC guard у `App.tsx` наразі немає. Користувач з будь-якою
локальною PIN-сесією може відкрити прямий URL admin-сторінки. Це не є
повноцінним security boundary.

Старі маршрути `/clients`, `/brands`, `/products`, `/retail-networks` і `/admin/*`
перенаправляються на відповідні сторінки `/settings/*`.

## Запуск локально

### Вимоги

- Node.js 20+
- npm
- доступ до Supabase-проєкту

### Налаштування

```bash
npm install
```

Створіть `.env.local` на основі `.env.example`.

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Bash:

```bash
cp .env.example .env.local
```

Мінімальні browser-змінні:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_OAUTH_CLIENT_ID=...
```

Для локального Supabase deploy також потрібні:

```dotenv
SUPABASE_PROJECT_REF=...
SUPABASE_ACCESS_TOKEN=...
SUPABASE_DB_PASSWORD=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

Запуск:

```bash
npm run dev
```

Застосунок доступний на `http://localhost:5173`.

Офлайн-режиму немає. Без `VITE_SUPABASE_URL` і `VITE_SUPABASE_ANON_KEY`
застосунок не працює.

## Перший запуск порожньої бази

1. Застосуйте міграції:

   ```bash
   npx supabase db push
   ```

2. Додайте системні довідники:

   ```bash
   npx supabase db query --linked --file supabase/seed.sql
   ```

3. Створіть першого адміністратора:

   ```bash
   npm run create:admin -- "Admin User" 1234
   ```

PIN має складатися рівно з чотирьох цифр.

## Життєвий цикл скарги

### Створення

Обов'язкові поля:

- джерело;
- торгова мережа або коректний телефон клієнта;
- бренд;
- назва продукту;
- номер партії;
- група скарги;
- суть претензії;
- критичність;
- статус.

Поле **«Рішення / Відповідь»** під час створення не показується. Воно
необов'язкове й доступне після збереження скарги в режимі редагування.

Текстові required-поля перевіряються після `trim()`, тому рядок із пробілів
не вважається заповненим.

### Джерело

Підтримуються два типи:

- `network` — торгова мережа;
- `client` — телефон клієнта у форматі `+380` і дев'ять цифр.

Торгова мережа вводиться через autocomplete:

- можна вибрати існуючу активну мережу;
- можна ввести нову назву;
- при збереженні нова мережа створюється в `retail_networks`;
- порівняння назв ігнорує регістр та зайві пробіли.

### Продукт і бренд

- без вибраного бренду autocomplete показує всі активні продукти;
- після вибору бренду показуються продукти тільки цього бренду;
- вибір продукту може підставити бренд і SKU/штрихкод;
- якщо змінити бренд на несумісний, вибраний продукт і штрихкод очищаються;
- назву продукту можна ввести вручну, навіть якщо збігу в каталозі немає.

Каталог `/settings/products` підтримує окремий необов’язковий товарний ID (`products.external_id`).
Це бізнесовий/імпортний ідентифікатор із Excel, а не технічний UUID `products.id`.
У таблиці продуктів можна шукати за назвою, ID, SKU/штрихкодом і брендом.

Excel-можливості каталогу продуктів:

- шаблон містить колонки `id`, `Назва`, `SKU`, `Бренд`;
- імпорт оновлює існуючий товар за збігом `id`, SKU або назви з брендом;
- експорт формує файл із усіма товарами, включно з ID, SKU, брендом і активністю;
- опція «видаляти товари, яких немає у файлі» залишається destructive-дією і потребує обережності.

Довідник `/settings/brands` підтримує назву, активність і HEX-колір бренду.
У реєстрі скарг колонка **«Бренд»** показує компактний однорядковий `BrandBadge`
у glass-стилі; інші кнопки застосунку цей стиль не наслідують.

Колонка `brands.color` додається міграцією `20260626000002_add_brand_colors.sql`.
`src/lib/db.ts` має тимчасовий fallback для старого Supabase schema cache: якщо
PostgREST ще не бачить `brands.color`, записи брендів читаються з дефолтним
кольором `#64748B`, а `insert/update` повторюються без поля `color`. Це не
замінює застосування міграції — для збереження реальних кольорів потрібно
виконати міграції й оновити schema cache.

### Редагування

У відкритій скарзі можна змінювати основні поля, групу, критичність, статус
і **«Рішення / Відповідь»**. Зміни, виконані через `updateComplaint()` у
штатному UI, записуються в `complaint_change_log`. Прямі записи через REST,
SQL або інший клієнт можуть обійти цей журнал, оскільки database trigger
для повного аудиту наразі відсутній.

Статус із `is_closed = true` закриває скаргу. Закрита скарга не редагується,
але її можна перевідкрити.

## Довідники статусів, критичності та груп

Сторінка `/settings/statuses` має три вкладки.

### Статуси скарг

Для статусу налаштовуються:

- назва;
- HEX-колір;
- порядок;
- фон картки/рядка реєстру у відсотках (`registry_tint_percent`, 0-100);
- тінь картки/рядка реєстру (`registry_shadow_enabled`);
- `is_active`;
- `is_closed`.

Поля `registry_tint_percent` і `registry_shadow_enabled` додані міграцією `20260709000001_add_status_registry_style.sql`. Значення `10` означає 10% кольору статусу; для `Закрито` seed і міграція задають чорний `#000000` із `10%` і вимкненою тінню. Реєстр застосовує цей стиль до всіх клітинок desktop-рядка та до всієї mobile-картки з легким glass overlay.

Активний системний набір після міграції `20260625000000_normalize_complaint_statuses.sql`:

1. **Новий**
2. **В роботі**
3. **В роботі виробництво**
4. **В роботі ВКЯ**
5. **В роботі продакт-менеджер**
6. **Очікує відповідь клієнта**
7. **Очікує ВКЯ**
8. **Закрито**
9. **Відхилено**

Міграція переводить legacy-назви `Нова`, `Закрита`, `Відхилена` на канонічні рядки,
вимикає зайві дублікати й не перетирає наявні HEX-кольори.

Неактивний статус не пропонується для нових змін, але залишається видимим у
старих скаргах та історії. Статус, який уже використовується, не можна
видалити: його потрібно вимкнути.

### Критичність

Для рівня критичності налаштовуються:

- назва;
- HEX-колір;
- порядок;
- активність.

Активні рівні критичності після міграції `20260626000000_merge_critical_severity_into_high.sql`:

1. **Інформаційна**
2. **Низька**
3. **Середня**
4. **Висока**

`Критична` об'єднана з `Висока`: скарги й записи історії змін переводяться на `Висока`,
а колір `Висока` зберігається. У новому seed `Критична` більше не створюється.

Кольори критичності використовуються в бейджах реєстру й деталей.
Статусні кольори також використовуються в аналітиці.

### Групи скарг

Група має назву, порядок і активність. Початковий seed:

1. Етикування
2. Сировина
3. Комплектуючі
4. Терміни
5. Реакція на використання
6. Логістичні скарги
7. Інші

Неактивна група не показується у новій скарзі, але зберігається в уже
створених записах. Міграція `20260615000001_add_complaint_groups.sql`
призначає старим скаргам групу **«Інші»**.

## Реєстр скарг

Маршрут: `/complaints`.

Заголовок сторінки **`Oops!`** є навмисним продуктовим текстом. Не замінювати
його на «Реєстр скарг» під час рефакторингів або виправлень UI.

Можливості:

- desktop table і mobile cards;
- 50 записів на сторінку;
- сортування за номером: нові зверху;
- пошук за номером, партією, групою, продуктом, штрихкодом, телефоном,
  суттю претензії та рішенням;
- лічильник вкладень і унікальних переглядів;
- швидка клікабельна зміна статусу з confirmation dialog;
- копіювання **«Рішення / Відповідь»** через іконку біля скороченого тексту;
- системна колонка **«Відкрити»** як movable registry field `open_action`;
- статусна підсвітка всього рядка/картки через `registry_tint_percent`, `registry_shadow_enabled` і `.registry-status-glass`;
- видалення скарги адміністратором;
- налаштовувані колонки.

Фільтри:

- статуси;
- рівні критичності;
- групи скарг;
- бренди;
- типи джерела;
- торгові мережі;
- менеджери;
- дата від;
- дата до.

Усі довідникові фільтри підтримують множинний вибір через `MultiSelect`. Якщо вибрано тільки тип джерела **«Тільки клієнти»**, фільтр торгових мереж очищається та блокується.

На desktop поля **«Дата від»** і **«Дата до»** розташовані в одному рядку.
Після зміни будь-якого фільтра або пошуку пагінація повертається на першу
сторінку.

### Колонки реєстру

Системні й кастомні колонки беруться з `field_definitions` для entity
`complaints`.

Важливі прапорці:

- `is_active`;
- `is_visible`;
- `show_in_registry`;
- `sort_order`.

Адміністратор може керувати ними:

1. на `/settings/fields`;
2. кнопкою **«Колонки»** у реєстрі.

Системна дія `open_action` додає кнопку **«Відкрити»** у реєстр. Вона не є бізнес-полем скарги, але показується в діалозі колонок і може переміщуватися між іншими колонками; desktop-заголовок цієї колонки візуально прихований.

`show_in_create` і `show_in_details` зберігаються в metadata, але основні
форми скарги наразі реалізовані явними React-полями. Автоматичний dynamic
form builder для `custom_fields` ще не реалізований.

## Аналітика

Маршрут: `/analytics`.

Підтримуються:

- період: день, тиждень або місяць;
- множинні фільтри за брендами, товарами, статусами, критичністю,
  торговими мережами та менеджерами;
- картки загальної кількості, нових, у роботі та закритих;
- графік динаміки;
- розподіл за статусом;
- розподіл за брендом.

## Коробки

Маршрут: `/boxes`.

Пункт **«Коробки»** показується в основній навігації під **«Аналітика»**. Сторінка підбирає найменшу транспортну коробку, яка вміщує товар за введеними габаритами, та показує альтернативні варіанти. Дані завантажуються з Supabase-таблиці `boxes`; якщо таблиця недоступна або порожня, frontend використовує fallback `src/data/boxes.generated.json`, згенерований із доданого проєкту `BOX`.

## Обробка помилок запитів

Основні сторінки та CRUD-довідники розрізняють:

- початкове завантаження;
- успішні дані;
- порожній результат;
- помилку запиту;
- помилку фонового повторного завантаження.

При початковій помилці показується зрозуміле повідомлення та кнопка
**«Спробувати ще раз»**. Якщо попередні дані вже є, тимчасова помилка
оновлення не приховує сторінку: застосунок залишає останні успішні дані й
показує компактне попередження.

Технічна причина доступна в розкривному блоці **«Технічні деталі»**.
Спільний UI-компонент:

```text
src/components/ui/query-state.tsx
```

## Основні таблиці Supabase

| Таблиця | Призначення |
|---|---|
| `users` | PIN-користувачі та ролі |
| `brands` | бренди, активність і HEX-колір бейджа |
| `products` | каталог продуктів, SKU і необов’язковий товарний `external_id` |
| `retail_networks` | торгові мережі |
| `clients` | довідник клієнтів |
| `complaint_statuses` | статуси, колір, порядок, registry tint/shadow, закриття, активність |
| `severity_levels` | критичність, колір, порядок, активність |
| `complaint_groups` | редаговані групи скарг |
| `complaints` | основні записи скарг |
| `complaint_attachments` | metadata файлів Google Drive |
| `complaint_views` | унікальні перегляди скарг за парою `complaint_id` + `user_id` |
| `complaint_change_log` | історія змін |
| `boxes` | каталог транспортних коробок для `/boxes` |
| `complaint_summary_rows` | денормалізовані рядки для webhook/n8n |
| `entity_definitions` | metadata сутностей |
| `field_definitions` | metadata полів і колонок |
| `entity_records` | записи кастомних сутностей |
| `app_settings` | публічні налаштування |
| `app_secrets` | server-only секрети |

### Основні поля `brands`

- `id`;
- `name`;
- `color` — HEX-колір бренду для бейджа в реєстрі;
- `is_active`;
- `created_at`.

`color` має дефолт `#64748B`. Після міграції `20260626000002_add_brand_colors.sql`
виконується `notify pgrst, 'reload schema'`, щоб Supabase/PostgREST оновив
schema cache.

### Основні поля `complaints`

- `number` — номер із Postgres sequence;
- `created_at`, `created_by`, `manager_id`;
- `source_type`, `retail_network_id`, `client_phone`;
- `brand_id`, `product_name`, `product_barcode`;
- `batch_number`;
- `complaint_group_id`;
- `problem_description`;
- `resolution_response`;
- `severity_id`, `status_id`;
- `drive_folder_id`, `drive_folder_url`;
- `closed_at`, `updated_at`;
- `custom_fields`.

## Нумерація скарг

Номер генерує Postgres sequence:

```text
public.complaint_number_seq
```

Frontend не використовує `max(number) + 1`. При вставці `number` не
передається, а база атомарно виставляє наступне значення.

Адміністративне керування лічильником реалізоване окремими RPC та
міграціями `20260530000000_*`, `20260530000001_*`,
`20260530000002_*`.

## Історія змін

`updateComplaint()` порівнює старі й нові значення та записує події в
`complaint_change_log`. Оновлення скарги й запис журналу виконуються
окремими запитами, тому журнал не є транзакційно гарантованим.

Підтримуються події:

- `created`;
- `field_updated`;
- `status_changed`;
- `reopened`;
- `file_added`;
- `file_deleted`.

Для reference-полів UI показує назви, а не UUID: статус, критичність,
групу скарги, бренд, мережу та користувача.

## Вкладення та Google Drive

Файл можна додати:

- під час створення скарги;
- пізніше в деталях скарги.

Потік завантаження:

1. frontend формує `FormData`;
2. `uploadAttachment()` викликає Edge Function `upload-attachment`;
3. функція перевіряє активного `uploaded_by`;
4. читає `drive.oauth` із `app_secrets`;
5. оновлює Google access token;
6. створює папку `complaint-<number>`;
7. завантажує файл;
8. встановлює `anyone with link reader`;
9. записує metadata в `complaint_attachments`.

Поточна дія видалення вкладення є soft delete тільки в Supabase metadata:
вона виставляє `is_deleted`, `deleted_at` і `deleted_by`. Файл у Google
Drive фізично не видаляється. Так само hard delete скарги видаляє пов'язані
metadata через cascade, але не гарантує очищення файлів у Drive.

### Підключення Google Drive

На `/settings/general` адміністратор натискає **«Підключити Google Drive»**.

`google-oauth-callback`:

- обмінює `code` на токени;
- створює або знаходить папку `Complaints`;
- зберігає `refresh_token` і `root_folder_id` у `app_secrets`
  з ключем `drive.oauth`;
- зберігає публічний статус у `app_settings`
  з ключем `drive.connection`.

Google Cloud:

- проєкт: `complaints-496120`;
- Drive API: enabled;
- OAuth client type: Web;
- redirect URI:
  `https://ihjvjwzomrbyitubovsg.supabase.co/functions/v1/google-oauth-callback`;
- scopes: `drive.file`, `userinfo.email`.

OAuth у режимі **Testing** може відкликати refresh token приблизно через
сім днів. Для стабільної роботи застосунок Google OAuth потрібно
опублікувати, після чого перепідключити Drive.

## PIN-автентифікація та безпека

Проєкт не використовує Supabase Auth.

- користувачі зберігаються в `public.users`;
- ролі: `manager`, `supervisor`, `admin`, `product_manager`, `qa`;
- PIN зберігається як детермінований SHA-256 hash зі статичним namespace
  `complaint-crm:`; окремої випадкової солі для кожного користувача немає;
- старий legacy hash оновлюється при успішному вході;
- сесія зберігається в `localStorage` під ключем `__auth_session__`;
- неактивний або видалений користувач втрачає сесію під час наступної
  стартової перевірки/перезавантаження застосунку.

Через application-level auth RLS дозволяє browser CRUD для `anon` на
потрібних таблицях. PIN-екран у цій архітектурі є UI-механізмом, а не
серверною межею доступу. Поточну конфігурацію можна використовувати тільки
в контрольованому внутрішньому середовищі; її не слід публікувати як
захищений CRM. Для реального контролю доступу потрібні server-issued
сесії/Supabase Auth і суворіші RLS.

Правила секретів:

- не комітити `.env.local`;
- `VITE_*` вважати публічними;
- не передавати service role key у React;
- Google refresh token зберігати тільки в `app_secrets`;
- Telegram token зберігати тільки в n8n credentials;
- не додавати реальні токени в README, код або issue.

## Інтеграція з n8n

Рекомендований потік:

```text
Supabase Database Webhook
  -> n8n Webhook
  -> formatting
  -> Google Sheets
  -> Telegram
```

Webhook:

```text
Table: public.complaint_summary_rows
Events: Insert + Update
Method: POST
Content-Type: application/json
```

`complaint_summary_rows` містить:

- `complaint_id`;
- `complaint_number`;
- `complaint_created_at`;
- `created_by_id`;
- `created_by_name`;
- `product_name`;
- `description`;
- `resend_requested_at`;
- `synced_at`.

Ця таблиця є чинним інтеграційним контрактом для n8n. Її назву, набір і
назви колонок, значення полів, події `Insert`/`Update`, тригери синхронізації
та семантику `resend_requested_at` не можна змінювати без окремого
узгодженого оновлення n8n workflow. Поточний рефакторинг frontend її не
змінює.

Кнопка **«Оновити»** в деталях викликає RPC
`request_complaint_resend`, змінює `resend_requested_at` і створює
`Update` webhook-подію.

Під час створення нової скарги з файлами frontend після завершення всіх
початкових upload-ів автоматично викликає той самий RPC, щоб n8n отримав
`Update` після появи metadata у `complaint_attachments`.

React-застосунок не містить Telegram token і не надсилає Telegram
повідомлення напряму.

## Виконано 18 червня 2026 року

- створено спільний `ComplaintFormState`, нормалізацію та required-валідацію;
- створення й редагування скарги підключено до спільних системних полів;
- реєстр розділено на список, фільтри, діалоги й типи;
- з деталей скарги винесено редактор, вкладення та історію змін;
- з аналітики винесено controls, charts, типи та чисті обчислення;
- виправлено повторне використання попереднього вибору в діалозі зміни
  статусу;
- додано production route entry pages для `/settings/statuses` і
  `/admin/statuses`;
- підтверджено, що заголовок **`Oops!`** є навмисним;
- інтеграційний контракт `complaint_summary_rows` для n8n залишено без змін.
- додано спільну обробку помилок запитів і повторне завантаження для
  основних сторінок та адміністративних довідників.

## Виконано 24 червня 2026 року

- статуси в реєстрі стали клікабельними й відкривають підтвердження зміни статусу;
- для кнопки **«Відкрити»** та статусів додано liquid glass-ефект із тоншим шрифтом;
- у деталях скарги додано швидке редагування рішення/відповіді через іконку олівця;
- додано унікальні перегляди скарг: таблиця `complaint_views`, RPC `record_complaint_view` і `get_complaint_view_counts`, лічильник з іконкою ока в реєстрі;
- додано GitHub Actions keepalive-запит для Supabase Free;
- каталог продуктів отримав пошук за назвою/ID/SKU, необов'язковий товарний ID, Excel-шаблон з `id`, імпорт з оновленням існуючих товарів і експорт усіх товарів.

## Виконано 26 червня 2026 року

- нормалізовано активні статуси скарг до канонічного набору з 9 назв;
- legacy-статуси `Нова`, `Закрита`, `Відхилена` переводяться на `Новий`, `Закрито`, `Відхилено` і вимикаються без втрати кольорів;
- рівень критичності `Критична` об'єднано з `Висока`: скарги й `complaint_change_log` remap-ляться на `Висока`;
- `supabase/seed.sql` оновлено: нові бази отримують канонічні статуси й 4 активні рівні критичності без `Критична`;
- fallback-бейджі й аналітика узгоджені з `Новий` та новим набором критичності;
- бренди отримали налаштовуваний HEX-колір і compact glass-бейдж тільки в колонці **«Бренд»** реєстру;
- `src/lib/db.ts` додав сумісність зі старим Supabase schema cache для `brands.color`, щоб уникати помилки `Could not find the 'color' column` до застосування міграції.

## Виконано 7 липня 2026 року

- додано вкладку **«Коробки»** під аналітикою та маршрут `/boxes`;
- імпортовано каталог коробок із проєкту `BOX` у `src/data/boxes.generated.json`;
- додано Supabase-таблицю `boxes`, типи, CRUD mapping і перевірку `check:supabase`;
- сторінка коробок використовує дані Supabase з fallback на локальний JSON;
- фільтри реєстру скарг переведено на множинний вибір для статусів, критичності, груп, брендів, джерел, мереж і менеджерів.

## Виконано 10 липня 2026 року

- додано згортання desktop sidebar до icon-only режиму з локальним збереженням стану;
- у `/settings/statuses` додано числовий фон реєстру `registry_tint_percent` і toggle тіні `registry_shadow_enabled`;
- додано міграцію `20260709000001_add_status_registry_style.sql`; `Закрито` отримує `#000000` і 10% прозорого фону для закритих рядків;
- `src/lib/db.ts` має fallback для старого Supabase schema cache, якщо нові status style колонки ще не доступні;
- реєстр застосовує підфарбування й легкий glass-ефект до всіх клітинок desktop-рядка та до всієї mobile-картки;
- колонка **«Відкрити»** стала системною movable registry action, а **«Рішення / Відповідь»** у реєстрі отримала іконку копіювання.

## Міграції та seed

Важливі останні міграції:

| Міграція | Зміна |
|---|---|
| `20260527000000_complaint_summary_rows.sql` | summary-таблиця і синхронізація |
| `20260529000001_add_complaint_resend_request.sql` | RPC повторної обробки |
| `20260530000000_complaint_number_counter_admin.sql` | керування лічильником |
| `20260603000000_status_and_severity_colors.sql` | HEX-кольори статусів і критичності |
| `20260615000000_add_complaint_resolution_response.sql` | поле рішення/відповіді |
| `20260615000001_add_complaint_groups.sql` | довідник і поле групи скарги |
| `20260623000000_add_complaint_unique_views.sql` | унікальні перегляди скарг і RPC для лічильників |
| `20260624000000_add_product_external_id.sql` | необов’язковий товарний ID у каталозі продуктів |
| `20260625000000_normalize_complaint_statuses.sql` | канонічний набір статусів, remap legacy-назв і збереження кольорів |
| `20260626000000_merge_critical_severity_into_high.sql` | об'єднання `Критична` з `Висока`, remap скарг і change log |
| `20260706000000_add_boxes.sql` | таблиця `boxes`, RLS і початковий каталог коробок |
| `20260709000001_add_status_registry_style.sql` | `registry_tint_percent` і `registry_shadow_enabled` для статусного оформлення реєстру |

`supabase/seed.sql` містить тільки:

- статуси;
- рівні критичності;
- групи скарг;
- системні `entity_definitions`;
- системні `field_definitions`.

Не додавайте в seed реальних користувачів, бренди, продукти, мережі,
клієнтів або скарги. Ними керує UI.

## Деплой

### Supabase локально

```bash
npm run deploy:supabase
```

Скрипт:

1. визначає project ref;
2. виконує `supabase link`;
3. виконує `supabase db push`;
4. запускає `supabase/seed.sql`;
5. встановлює Google OAuth secrets;
6. деплоїть `upload-attachment`;
7. деплоїть `google-oauth-callback`.

Після деплою:

```bash
npm run check:supabase
```

### GitHub Pages

`.github/workflows/deploy.yml` запускається після push у `main`.

Потрібні repository variables:

| Variable | Значення |
|---|---|
| `SUPABASE_URL` | URL Supabase |
| `SUPABASE_ANON_KEY` | browser anon key |
| `GOOGLE_OAUTH_CLIENT_ID` | публічний OAuth client id |

CI встановлює `VITE_BASE_PATH=/<repo>/`. Для цього репозиторію production
base path — `/0/`.

`npm run build` також створює route entry pages і `404.html`, щоб прямі
GitHub Pages URL працювали з React Router.

### Supabase keepalive

`.github/workflows/supabase-keepalive.yml` запускається щодня опівночі за Europe/Kyiv і робить легкий REST-запит до `complaints`.
Мета — не дати Supabase Free-проєкту перейти в неактивний стан. Workflow використовує repository variables `SUPABASE_URL` і `SUPABASE_ANON_KEY`.

### Supabase GitHub Actions

`.github/workflows/supabase-migrate.yml` запускається при змінах у:

- `supabase/migrations/**`;
- `supabase/functions/**`;
- `supabase/seed.sql`;
- самому workflow.

Потрібні:

| Тип | Ім'я |
|---|---|
| Variable | `SUPABASE_PROJECT_REF` |
| Secret | `SUPABASE_ACCESS_TOKEN` |
| Secret | `SUPABASE_DB_PASSWORD` |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` |

## Команди

| Команда | Дія |
|---|---|
| `npm run dev` | Vite dev server на 5173 |
| `npm run build` | TypeScript build, Vite build, route pages |
| `npm run preview` | локальний preview `dist` |
| `npm run lint` | `tsc --noEmit` |
| `npm run check:supabase` | базова перевірка REST і Edge Functions |
| `npm run create:admin -- "Name" 1234` | створення першого admin |
| `npm run deploy:supabase` | migrations, seed, secrets, functions |

У Windows sandbox Vite/esbuild інколи завершується з `spawn EPERM`.
Повторний запуск поза sandbox зазвичай проходить без змін коду.

## Документація

- `README.md` — публічна документація, відстежується Git.
- `AGENT.md` — локальна технічна пам'ятка для агентів, ігнорується Git.

Після змін схеми, маршрутів, env, workflow або ключових UI-сценаріїв
оновлюйте обидва файли.

## Корисні посилання

- GitHub: https://github.com/complaint-procare/0
- Supabase documentation: https://supabase.com/docs
- Google Drive API documentation: https://developers.google.com/drive/api
- Локальний застосунок: http://localhost:5173

Посилання на конкретні Dashboard/credentials сторінки зберігаються в
локальному `AGENT.md`, а не в публічній документації.

## Відомі компроміси

### Критичні

- `anon` має CRUD-доступ до основних таблиць. Supabase anon key є
  публічним browser key, тому PIN-екран не забороняє прямі REST-запити.
- Таблиця `users`, включно з `pin_hash`, читається через `anon`. Простір
  чотиризначних PIN містить лише 10 000 варіантів, а статичний namespace не
  захищає від офлайн-перебору.
- Локальну сесію в `localStorage` можна змінити вручну. Роль із цієї сесії
  керує UI, але не є доказом ролі для Supabase.
- `upload-attachment` і `google-oauth-callback` деплояться з
  `--no-verify-jwt`. Завантаження довіряє переданому `uploaded_by`, а OAuth
  callback не прив'язаний до server-side сесії адміністратора.
- Google Drive файли отримують `anyone with link reader`; це може бути
  неприйнятним для фото, відео або персональних даних клієнта.

### Високі

- Оновлення скарги та change log не атомарні. Створення скарги, початковий
  log і завантаження файлів також виконуються послідовно: часткова помилка
  може залишити вже створену скаргу або файл.
- Ключова валідація існує переважно в React. База дозволяє порожні тексти,
  nullable статус/критичність/групу та некоректні комбінації джерела.
- Видалення вкладення не видаляє файл із Google Drive, хоча частина UI
  описує дію як видалення зі сховища.
- Немає optimistic locking/version check: паралельне редагування працює за
  принципом last write wins.
- Автоматизованих unit, integration і E2E тестів немає. `npm run lint`
  фактично запускає лише `tsc --noEmit`.

### Масштабування та експлуатація

- Реєстр завантажує всі скарги, вкладення й довідники, після чого фільтрує
  та ділить їх на сторінки в браузері. Деталі скарги завантажують весь
  change log і всі attachment metadata перед локальною фільтрацією.
- Аналітика завантажує всі скарги й визначає «Нові» та «В роботі» за
  редагованими назвами статусів.
- Значення карток аналітики показують всю вибірку, але відсоткова зміна
  обчислюється лише між останніми двома семиденними періодами; це потрібно
  явно пояснити в UI або узгодити семантику.
- У репозиторії немає перевіреного автоматичного backup/restore сценарію.
  Для production потрібно окремо контролювати квоти, резервні копії та
  відновлення Supabase.
- `show_in_create` і `show_in_details` поки не генерують форми автоматично.
- Активний шлях вкладень — Google Drive; історична Supabase Storage
  міграція залишається тільки як applied migration history.
- `app_settings` доступний browser-клієнту на читання й запис через широку
  anon policy; секрети мають бути тільки в `app_secrets`.

План усунення ризиків ведеться у `FUTURE.md`. Безпекові зміни потребують
окремого погодження, оскільки вони змінюють модель входу, RLS і деплой.
