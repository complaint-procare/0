# Complaint CRM

Внутрішній CRM для обробки скарг споживачів. React + Vite + TypeScript + Tailwind, дані — у Supabase, файлові вкладення — у Google Drive через OAuth.

## Стек

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, TanStack Query/Table, React Router v6
- **Бекенд**: Supabase (Postgres + RLS + Edge Functions на Deno)
- **Файли**: Google Drive (OAuth від імені користувача → файли в My Drive у папці `Complaints`)
- **Auth**: власна PIN-автентифікація (без Supabase Auth), сесія в `localStorage`
- **Деплой**: GitHub Pages (статика) + Supabase (БД + Edge Functions)

---

## Структура проєкту

```
src/
  App.tsx                       роутер
  components/
    Layout.tsx                  бічна навігація
    SettingsLayout.tsx          сабнаво для /settings/*
    Badges.tsx                  StatusBadge / SeverityBadge
    ui/                         базові примітиви + Dialog/Toast/Multi-Select
    admin/                      CRUD-помічники
  lib/
    auth.tsx                    PIN-логін, useAuth(), isAdmin
    db.ts                       обгортки над supabase-js (list/getById/insert/update/remove)
    supabase.ts                 клієнт + uploadAttachment()
    complaints.ts               createComplaint / updateComplaint / change log
    types.ts                    TS-моделі (відповідають таблицям Postgres)
    utils.ts                    formatDate, hashPin, padComplaintNumber тощо
  pages/
    Complaints.tsx              реєстр + фільтри + діалог колонок (admin)
    ComplaintDetails.tsx        деталі скарги + вкладення + лог змін
    NewComplaint.tsx            форма створення з локальним превʼю файлів
    Analytics.tsx               аналітика
    Login.tsx                   PIN-екран
    admin/                      Brands, Products, Networks, Clients, Users,
                                Entities, Fields, Settings (Google Drive OAuth)
supabase/
  migrations/                   декларативна схема + RLS
  seed.sql                      ТІЛЬКИ системні дані (статуси, рівні критичності,
                                визначення сутностей/полів). Без демо-юзерів/брендів.
  functions/
    upload-attachment/          приймає файл від SPA → OAuth refresh → upload в Drive
    google-oauth-callback/      приймає ?code, обмінює на токени, зберігає в app_secrets
scripts/
  check-supabase.mjs            швидка перевірка стану БД + Edge Functions
  create-spa-route-pages.mjs    створює entry pages для GitHub Pages routes
  deploy-supabase.mjs           link → db push → secrets → deploy functions
```

---

## Запуск локально

```bash
# 1. Залежності
npm install

# 2. Створити .env.local на основі .env.example
cp .env.example .env.local
# заповнити:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   VITE_GOOGLE_OAUTH_CLIENT_ID
# для локального Supabase deploy додатково можна додати:
#   SUPABASE_ACCESS_TOKEN
#   SUPABASE_DB_PASSWORD
#   GOOGLE_OAUTH_CLIENT_ID
#   GOOGLE_OAUTH_CLIENT_SECRET

# 3. Dev server
npm run dev          # http://localhost:5173
```

PIN за замовчуванням — той, що поставили в адмінці (`/settings/users`). Для першого admin у порожній БД після `supabase db push` + `supabase db query --linked --file supabase/seed.sql` запустіть:

```bash
npm run create:admin -- "Admin User" 1234
```

Офлайн/IndexedDB режим вимкнено: застосунок потребує `VITE_SUPABASE_URL` і `VITE_SUPABASE_ANON_KEY`.

---

## Деплой

### Supabase (БД + Edge Functions)

```bash
npm run deploy:supabase
```

Робить:
1. `supabase link --project-ref <ref>`
2. `supabase db push` — застосовує нові міграції
3. `supabase secrets set` — кладе `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` з `.env.local`
4. Деплоїть Edge Functions `upload-attachment` і `google-oauth-callback`

**Якщо `db push` падає з `type ... already exists`** — це означає що існуючі міграції не марковані як applied на віддаленому Supabase. Виправлення:
```bash
for v in <всі попередні версії>; do
  npx supabase migration repair --status applied "$v"
done
```

### GitHub Pages (frontend)

Workflow `.github/workflows/deploy.yml` пушить білд при push в `main`.

Потрібні GitHub Actions змінні/секрети:

| Тип | Імʼя | Для чого |
|---|---|---|
| Variable | `SUPABASE_URL` | `VITE_SUPABASE_URL` у frontend build |
| Variable | `SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` у frontend build |
| Variable | `GOOGLE_OAUTH_CLIENT_ID` | `VITE_GOOGLE_OAUTH_CLIENT_ID` у frontend build |

`npm run build` також створює `404.html` і статичні entry pages для основних React routes, щоб прямі GitHub Pages URL на кшталт `/0/complaints` повертали `200`. Динамічні detail URLs (`/0/complaints/<id>`) рендеряться через `404.html`, бо GitHub Pages не підтримує wildcard-файли.

### GitHub Actions для Supabase

Workflow `.github/workflows/supabase-migrate.yml` запускається при змінах у `supabase/migrations/**`, `supabase/functions/**`, `supabase/seed.sql` або самому workflow.

Потрібні GitHub Actions змінні/секрети:

| Тип | Імʼя | Для чого |
|---|---|---|
| Variable | `SUPABASE_PROJECT_REF` | `supabase link` |
| Secret | `SUPABASE_ACCESS_TOKEN` | Supabase CLI deploy |
| Secret | `SUPABASE_DB_PASSWORD` | `supabase db push` |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` | Edge Function OAuth client id |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` | Edge Function OAuth client secret |

CI виставляє Google OAuth secrets у Supabase перед деплоєм і деплоїть обидві Edge Functions: `upload-attachment` та `google-oauth-callback`. Якщо OAuth secrets відсутні, workflow падає, щоб не деплоїти функції у напівзламаному стані.

---

## Google Drive (OAuth)

Додаток отримує OAuth refresh_token від реального користувача:

1. У `/settings/general` адмін натискає **Підключити Google Drive**
2. Google запитує дозвіл (scope `drive.file` + `userinfo.email`)
3. Callback `google-oauth-callback` обмінює `code` на токени, створює (або знаходить) папку **Complaints** у My Drive і зберігає:
   - `refresh_token` + `root_folder_id` → `public.app_secrets` (service-role only)
   - публічний статус (email, дата, папка) → `public.app_settings`
4. Кожне завантаження файлу: `upload-attachment` бере refresh_token, оновлює access_token, кладе файл у `complaint-<номер>/`, ставить дозвіл `anyone with link reader` → thumbnail-и працюють у браузері

### Налаштування в Google Cloud Console (одноразово)

- Проєкт: `complaints-496120`
- Drive API: enabled
- OAuth consent: External / Testing, test users додаються вручну
- OAuth Client ID (Web):
  - Redirect URI: `https://ihjvjwzomrbyitubovsg.supabase.co/functions/v1/google-oauth-callback`
- Scopes: `auth/drive.file`, `auth/userinfo.email`

---

## Аутентифікація користувачів

Власна PIN-схема, **не** Supabase Auth:
- Користувачі — рядки в `public.users` з ролями `manager | supervisor | admin | product_manager | qa`
- PIN зберігається як SHA-256 хеш з salt-префіксом (див. `hashPin` в `src/lib/utils.ts`)
- При вході екран `Login.tsx` хешує введений PIN і шукає збіг
- Сесія — `__auth_session__` у `localStorage`
- RLS-політики дозволяють anon все, бо аутентифікація — апплікаційна (не БД-рівня). Це усвідомлений компроміс для внутрішнього CRM.

---

## Форми скарг

Створення та редагування скарги використовують однакову required-валідацію для ключових полів: джерело, бренд, назва продукту, номер партії, суть претензії, критичність і статус. Текстові required-поля перевіряються після `trim()`, щоб рядок із самих пробілів не проходив як заповнене значення.

У формі створення скарги торгова мережа вводиться через autocomplete:
- можна вибрати існуючу мережу з підказок;
- можна ввести нову назву вручну;
- при збереженні нова назва створюється в `retail_networks` і надалі зʼявляється в підказках;
- збіг існуючої назви перевіряється без урахування регістру й зайвих пробілів.

Каталог продуктів у підказках фільтрується за вибраним брендом:
- якщо бренд не вибрано — показуються всі активні продукти;
- якщо бренд вибрано — показуються тільки активні продукти цього бренду;
- вибір продукту з каталогу може автоматично підставити бренд і штрихкод.

---

## Реєстр скарг (`/complaints`)

Колонки керуються таблицею `field_definitions` (entity `complaints`):
- `show_in_registry` — показувати в таблиці
- `sort_order` — порядок зліва направо

**Адмін** має дві точки керування:
1. `/settings/fields` — CRUD метаданих полів і керування видимістю колонок у реєстрі
2. Кнопка **«Колонки»** на сторінці реєстру — швидкий toggle + ←/→ перевпорядкування. Зміни одразу видно всім.

---

## Нумерація скарг

Номер скарги (`complaints.number`) генерується в Postgres через `public.complaint_number_seq`.
Frontend не рахує `max(number) + 1`; при створенні скарги рядок вставляється без `number`, а БД атомарно ставить наступне значення.

Міграція `20260513000003_cleanup_legacy_storage_and_numbering.sql` синхронізує sequence з наявними даними:

```sql
setval('public.complaint_number_seq', max(number) + 1, false)
```

---

## Скрипти

| Команда | Що робить |
|---|---|
| `npm run dev` | Vite dev server на 5173 |
| `npm run build` | TS check + production build у `dist/` |
| `npm run preview` | Локальний preview збірки |
| `npm run lint` | `tsc --noEmit` — тип-чек без емісії |
| `npm run check:supabase` | Перевірка Supabase REST, основних таблиць і Edge Functions |
| `npm run create:admin -- "Admin User" 1234` | Створити першого admin у Supabase через `.env.local` |
| `npm run deploy:supabase` | Повний деплой: migrations + secrets + functions |

---

## Корисні посилання

- **Supabase Dashboard**: https://supabase.com/dashboard/project/ihjvjwzomrbyitubovsg
- **Google Cloud Console**: https://console.cloud.google.com/apis/credentials?project=complaints-496120
- **OAuth consent (Audience)**: https://console.cloud.google.com/auth/audience
- **GitHub repo**: https://github.com/complaint-procare/0
- **Локальний застосунок**: http://localhost:5173

---

## Відомі компроміси / TODO

- `public.app_settings` відкритий для anon (`drive.connection` показує email — це ок, він не секретний). Якщо потрібна суворіша ізоляція — переїхати на політику з allow-list ключів.
- RLS відкритий для anon на всіх таблицях через PIN-схему. Якщо буде експозиція назовні — реалізувати справжній Supabase Auth.
- Edge Function `upload-attachment` НЕ перевіряє JWT (`--no-verify-jwt`). Авторизація — `uploaded_by` валідується проти `public.users`. Якщо переходити на справжній auth — увімкнути `verify_jwt`.
- `seed.sql` — лише системні довідники. Брендів/продуктів/мереж/юзерів **не** додавати — управляються через UI.
- Google OAuth у режимі **Testing** дає refresh_token на 7 днів. Для production — Publish App на Audience-сторінці.
- Історична міграція `20260512000002_storage.sql` лишається в репозиторії як applied migration history, але активний шлях вкладень — Google Drive OAuth. Cleanup-міграція прибирає legacy Storage policies і старий `drive.base_folder`.
