# Complaint CRM

Внутрішній вебзастосунок для реєстрації, обробки та аналізу скарг споживачів.

Актуальний стан документації: **18 червня 2026 року**.

## Основні можливості

- вхід працівників за чотиризначним PIN;
- створення скарги від торгової мережі або клієнта за телефоном;
- вибір бренду, продукту, номера партії, групи скарги, критичності та статусу;
- текстове поле **«Рішення / Відповідь»**, яке з'являється після створення скарги;
- вкладення фото, відео й інших файлів у Google Drive;
- реєстр із пошуком, фільтрами, налаштовуваними колонками та пагінацією;
- історія змін полів, статусів і вкладень;
- аналітика за періодом, статусами, брендами та іншими фільтрами;
- адміністрування користувачів, довідників, полів і Google Drive OAuth;
- денормалізована таблиця для Supabase Database Webhooks, n8n, Google Sheets і Telegram.

## Стек

- **Frontend:** React 18, Vite 5, TypeScript, React Router 6
- **UI:** Tailwind CSS, Lucide React, локальні UI-примітиви
- **Дані:** TanStack Query, TanStack Table
- **Backend:** Supabase Postgres, RLS, RPC, тригери
- **Serverless:** Supabase Edge Functions на Deno
- **Файли:** Google Drive OAuth
- **Auth:** власна PIN-автентифікація без Supabase Auth
- **Frontend deploy:** GitHub Pages
- **Backend deploy:** Supabase CLI та GitHub Actions

## Структура проєкту

```text
src/
  App.tsx                       маршрути застосунку
  components/
    Layout.tsx                  desktop/mobile shell і навігація
    SettingsLayout.tsx          заголовки сторінок /settings/*
    Badges.tsx                  кольорові StatusBadge / SeverityBadge
    admin/
      SimpleCrud.tsx            спільний CRUD довідників
      ProductsExcelImport.tsx   імпорт продуктів з Excel
    analytics/
      AnalyticsControls.tsx     фільтри та перемикач періоду
      AnalyticsCharts.tsx       картки, графік і breakdown
      analytics-calculations.ts чисті функції аналітики
      analytics-types.ts        типи аналітики
    complaints/
      ComplaintFormFields.tsx   спільні поля create/edit форми
      ComplaintEditor.tsx       редактор скарги
      ComplaintAttachments.tsx  вкладення
      ComplaintChangeLog.tsx    історія змін
      ComplaintRegistryList.tsx список і пагінація реєстру
      ComplaintRegistryFilters.tsx
      ComplaintRegistryDialogs.tsx
      registry-types.ts
    ui/
      autocomplete.tsx
      dialog.tsx
      multi-select.tsx
      primitives.tsx
      source-picker.tsx
      toast.tsx
  lib/
    auth.tsx                    PIN-сесія, useAuth(), ролі
    complaint-form.ts           стан, нормалізація і валідація форми
    complaints.ts               створення/оновлення скарг, вкладення, лог
    db.ts                       типізовані CRUD-обгортки Supabase
    supabase.ts                 browser client і uploadAttachment()
    types.ts                    моделі таблиць Postgres
    utils.ts                    форматування, PIN hash, номер скарги
  pages/
    Login.tsx
    Complaints.tsx              реєстр, фільтри, колонки, пагінація
    NewComplaint.tsx            створення скарги
    ComplaintDetails.tsx        деталі, редагування, файли, історія
    Analytics.tsx
    admin/
      Brands.tsx
      Clients.tsx
      Entities.tsx
      Fields.tsx
      Networks.tsx
      Products.tsx
      Settings.tsx              Google Drive OAuth
      Statuses.tsx              статуси, критичність, групи скарг
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
```

## Маршрути та доступ

| Маршрут | Призначення | Доступ |
|---|---|---|
| `/login` | PIN-вхід | усі |
| `/complaints` | реєстр скарг | авторизовані |
| `/complaints/new` | створення скарги | авторизовані |
| `/complaints/:id` | деталі й редагування | авторизовані |
| `/analytics` | аналітика | авторизовані |
| `/settings/clients` | клієнти | авторизовані |
| `/settings/brands` | бренди | авторизовані |
| `/settings/products` | продукти | авторизовані |
| `/settings/networks` | торгові мережі | авторизовані |
| `/settings/users` | користувачі та PIN | admin |
| `/settings/entities` | конструктор сутностей | admin |
| `/settings/fields` | metadata полів | admin |
| `/settings/statuses` | статуси, критичність, групи | admin |
| `/settings/general` | Google Drive OAuth | admin |

Позначка `admin` описує поточну навігацію: `Layout.tsx` приховує ці пункти
від інших ролей. Окремого route-level RBAC guard у `App.tsx` наразі немає,
тому це не є повноцінним security boundary.

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

### Редагування

У відкритій скарзі можна змінювати основні поля, групу, критичність, статус
і **«Рішення / Відповідь»**. Усі зміни записуються в
`complaint_change_log`.

Статус із `is_closed = true` закриває скаргу. Закрита скарга не редагується,
але її можна перевідкрити.

## Довідники статусів, критичності та груп

Сторінка `/settings/statuses` має три вкладки.

### Статуси скарг

Для статусу налаштовуються:

- назва;
- HEX-колір;
- порядок;
- `is_active`;
- `is_closed`.

Неактивний статус не пропонується для нових змін, але залишається видимим у
старих скаргах та історії. Статус, який уже використовується, не можна
видалити: його потрібно вимкнути.

### Критичність

Для рівня критичності налаштовуються:

- назва;
- HEX-колір;
- порядок;
- активність.

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
- лічильник вкладень;
- швидка зміна статусу;
- видалення скарги адміністратором;
- налаштовувані колонки.

Фільтри:

- статус;
- критичність;
- група скарги;
- бренд;
- тип джерела;
- торгова мережа;
- менеджер;
- дата від;
- дата до.

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

## Основні таблиці Supabase

| Таблиця | Призначення |
|---|---|
| `users` | PIN-користувачі та ролі |
| `brands` | бренди |
| `products` | каталог продуктів |
| `retail_networks` | торгові мережі |
| `clients` | довідник клієнтів |
| `complaint_statuses` | статуси, колір, порядок, закриття, активність |
| `severity_levels` | критичність, колір, порядок, активність |
| `complaint_groups` | редаговані групи скарг |
| `complaints` | основні записи скарг |
| `complaint_attachments` | metadata файлів Google Drive |
| `complaint_change_log` | історія змін |
| `complaint_summary_rows` | денормалізовані рядки для webhook/n8n |
| `entity_definitions` | metadata сутностей |
| `field_definitions` | metadata полів і колонок |
| `entity_records` | записи кастомних сутностей |
| `app_settings` | публічні налаштування |
| `app_secrets` | server-only секрети |

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
`complaint_change_log`.

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
- PIN зберігається як salted SHA-256 hash;
- старий legacy hash оновлюється при успішному вході;
- сесія зберігається в `localStorage` під ключем `__auth_session__`;
- неактивний або видалений користувач втрачає сесію.

Через application-level auth RLS дозволяє browser CRUD для `anon` на
потрібних таблицях. Це прийнятний компроміс лише для внутрішнього
застосунку. Для публічного доступу потрібні Supabase Auth і суворіші RLS.

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

- Supabase Dashboard:
  https://supabase.com/dashboard/project/ihjvjwzomrbyitubovsg
- Google Cloud credentials:
  https://console.cloud.google.com/apis/credentials?project=complaints-496120
- Google OAuth audience:
  https://console.cloud.google.com/auth/audience
- GitHub:
  https://github.com/complaint-procare/0
- Локальний застосунок:
  http://localhost:5173

## Відомі компроміси

- PIN-auth і відкриті anon policies не підходять для публічного CRM.
- Admin-only navigation не замінює route-level authorization.
- `upload-attachment` і `google-oauth-callback` деплояться з
  `--no-verify-jwt`.
- Авторизація завантаження перевіряється через `uploaded_by` у `users`.
- `show_in_create` і `show_in_details` поки не генерують форми автоматично.
- Активний шлях вкладень — Google Drive; історична Supabase Storage
  міграція залишається тільки як applied migration history.
- `app_settings` доступний browser-клієнту; секрети мають бути тільки в
  `app_secrets`.
