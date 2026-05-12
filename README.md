# Реєстр скарг (Complaint CRM)

CRM-подібний веб-додаток для централізованого реєстру скарг клієнтів з конструктором сутностей та полів.
Стек: **Vite + React + TypeScript + Tailwind + Supabase + Google Drive**.
Деплой — GitHub Pages через GitHub Actions.

Інтерфейс — у світлій BEXET-стилістиці: біла бічна панель, чорний активний стан, м'які пастельні бейджі статусів і критичності, заокруглені картки.

> Поки `VITE_SUPABASE_URL` порожній — додаток працює офлайн на IndexedDB (через `localforage`).
> Як тільки ви заповнюєте `.env.local` — клієнт `supabase-js` стає доступним через `src/lib/supabase.ts`.

---

## Архітектура

```
┌──────────────┐      JWT      ┌───────────────────┐     RPC      ┌──────────────┐
│  SPA (Pages) │ ────────────▶ │ Supabase Postgres │ ◀──────────  │ Edge Function│
│  React+Vite  │ ◀──────────── │   + RLS + Auth    │              │ upload-      │
└──────────────┘   anon key    └───────────────────┘              │ attachment   │
        │                                                          └──────┬───────┘
        │ multipart upload (file + complaint_id)                          │ Drive API
        └──────────────────────────────────────────────────────────────▶  ▼
                                                            ┌─────────────────────┐
                                                            │ Google Drive folder │
                                                            │  (service account)  │
                                                            └─────────────────────┘
```

Розташування на диску:
```
.
├── .github/workflows/
│   ├── deploy.yml             # build + Pages deploy
│   └── supabase-migrate.yml   # db push + functions deploy
├── docs/
│   ├── DEPLOYMENT.md          # деталі CI/CD
│   └── GOOGLE_DRIVE_SETUP.md  # service-account кроки
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260512000000_init_schema.sql
│   │   ├── 20260512000001_rls.sql
│   │   └── 20260512000002_storage.sql
│   ├── seed.sql
│   └── functions/upload-attachment/index.ts
├── src/
│   ├── components/, pages/    # UI
│   └── lib/
│       ├── db.ts              # IndexedDB шар (fallback)
│       ├── supabase.ts        # supabase-js клієнт + uploadAttachment()
│       ├── auth.tsx, types.ts, complaints.ts, seed.ts, utils.ts
├── .env.local                 # усі локальні ключі для app + deploy (gitignored)
├── scripts/
│   ├── check-supabase.mjs     # health-check Supabase/Auth/Function/Storage
│   └── deploy-supabase.mjs    # локальний deploy-helper для Supabase
└── vite.config.ts             # base = VITE_BASE_PATH ?? './'
```

---

## Швидкий старт (локально)

```bash
npm install
cp .env.example .env.local      # заповнити VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                     # http://localhost:5173
```

Локальний `.env.local` також може містити deploy-секрети для скриптів:

```bash
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_DB_PASSWORD=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=...
```

На поточному стенді вже налаштовані Supabase URL/anon key, `SUPABASE_ACCESS_TOKEN`,
Google service account і Drive folder ID. Для повного `npm run deploy:supabase`
ще потрібен `SUPABASE_DB_PASSWORD`.

### Демо PIN-коди (seed)

| PIN  | Роль             | Користувач         |
|------|------------------|--------------------|
| 1234 | Адміністратор    | Адмін Адмінович    |
| 1111 | Менеджер         | Ірина Менеджер     |
| 2222 | Керівник         | Олег Керівник      |
| 3333 | Продакт-менеджер | Марія Продакт      |
| 4444 | ВКЯ              | Тарас ВКЯ          |

PIN-и зберігаються як SHA-256 хеші. Адмін може створювати нових користувачів і змінювати PIN-и в **Налаштування → Користувачі**.

---

## Навігація

Головна бічна панель:

- **Скарги** — реєстр скарг
- **Аналітика** — метрики, графіки, фільтри
- **Налаштування** — Клієнти, Бренди, Продукти, Торгові мережі, Користувачі, Сутності, Поля, Загальні

Старі URL (`/clients`, `/brands`, `/admin/users`…) автоматично редіректять на `/settings/*`.

---

## Що реалізовано (MVP)

- **PIN-вхід** з рольовою ідентифікацією та локальною сесією.
- **Реєстр скарг**: таблиця на desktop, картки 1×N на mobile, фільтри, пошук.
- **Створення/редагування скарг** з обов'язковими полями.
- **Деталі скарги**: повний перегляд, редагування, preview фото/відео, завантаження, видалення.
- **Історія змін**: фіксуються зміни полів, статусу, додавання/видалення файлів, перевідкриття.
- **Статуси**: Нова, В роботі, Очікує відповідь клієнта, Очікує ВКЯ, Закрита, Відхилена. Закриті — read-only.
- **Критичність**: 5 рівнів, «Висока» та «Критична» візуально виділені.
- **Вкладення**: будь-які файли. Локально через IndexedDB; у продакшені — Google Drive через Edge Function.
- **Аналітика** (`/analytics`): 4 картки метрик з трендом ±%, барчарт (День / Тиждень / Місяць), розбивки за статусами/брендами, multi-select фільтри.
- **Налаштування** (`/settings`): хаб для довідників і адмін-інструментів.
- **Конструктор сутностей / полів**: створення кастомних довідників та полів (text/textarea/number/date/boolean/select/reference).
- **Скидання локальних даних** (для офлайн-режиму).

---

## Модель даних Supabase

Створюється міграцією `supabase/migrations/20260512000000_init_schema.sql`. Основні таблиці:

| Таблиця                  | Призначення                                        |
|--------------------------|----------------------------------------------------|
| `users`                  | Користувачі CRM (мапиться на `auth.users.id`)      |
| `brands` / `products`    | Каталог продукції                                  |
| `retail_networks`        | Торгові мережі (EVA, Watsons, Prostor, Rozetka…)   |
| `clients`                | Клієнти                                            |
| `complaint_statuses`     | Довідник статусів (sort_order, is_closed)          |
| `severity_levels`        | Рівні критичності + Tailwind-класи `color`         |
| `entity_definitions`     | Конструктор сутностей                              |
| `field_definitions`      | Конструктор полів (з reference_entity_id)          |
| `entity_records`         | Записи кастомних сутностей (jsonb `data`)          |
| `complaints`             | Скарги; `number bigint` через `complaint_number_seq` |
| `complaint_attachments`  | Метадані файлів (drive_file_id, drive_url)         |
| `complaint_change_log`   | Аудит-лог змін                                     |
| `app_settings`           | Key/value налаштування                             |

**RLS** (`20260512000001_rls.sql`): read для будь-якого staff, write для admin / власника скарги. Helper-функції: `current_app_user()`, `is_admin()`, `is_staff()`.

**Storage** (`20260512000002_storage.sql`): приватний bucket `complaint-media` (100 MB ліміт, лише staff читає, admin видаляє).

**Seed** (`supabase/seed.sql`) дзеркалить `src/lib/seed.ts`: 5 користувачів, статуси, severity, бренди, продукти, мережі, entity/field definitions.

---

## Деплой

### GitHub Pages

`.github/workflows/deploy.yml`:
- `npm ci && npm run build` з `VITE_BASE_PATH=/<repo>/`
- копіює `dist/index.html → dist/404.html` (SPA fallback для React Router)
- публікує через `actions/deploy-pages@v4`

Налаштування у репо:
1. **Settings → Pages → Source: GitHub Actions**.
2. Variables: `SUPABASE_URL`, `SUPABASE_PROJECT_REF`.
3. Secrets: `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.

URL продакшена: `https://complaint-procare.github.io/0/`

### Supabase міграції

`.github/workflows/supabase-migrate.yml` тригериться на зміни у `supabase/`:
```
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase db push
supabase db query --linked --file supabase/seed.sql
supabase functions deploy upload-attachment --no-verify-jwt
```

Локально:
```bash
npm run deploy:supabase
npm run check:supabase
```

`deploy:supabase` читає всі локальні секрети тільки з `.env.local`.

---

## Google Drive

Edge Function `upload-attachment` ([supabase/functions/upload-attachment/index.ts](supabase/functions/upload-attachment/index.ts)):

1. Перевіряє JWT користувача через `supabase.auth.getUser()`.
2. Мапить його на `public.users.auth_id` → отримує `app_user.id`.
3. Якщо у скарги ще немає `drive_folder_id` — створює папку `complaint-<number>` усередині `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
4. Завантажує файл туди (multipart Drive API v3).
5. Створює рядок у `complaint_attachments` з `drive_file_id`, `drive_url`, `uploaded_by`.

Потрібні Supabase secrets:
```bash
supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_EMAIL='...@...iam.gserviceaccount.com' \
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(jq -r .private_key < key.json)" \
  GOOGLE_DRIVE_ROOT_FOLDER_ID='1A2b3C4d...'
```

Локально ці значення тримаються тільки в `.env.local`.

Повний гайд — [docs/GOOGLE_DRIVE_SETUP.md](docs/GOOGLE_DRIVE_SETUP.md).

---

## Telegram Mini App

Після публікації на Pages:
1. Створіть бота через [@BotFather](https://t.me/BotFather) → `/newbot`.
2. `/setmenubutton` → виберіть бота → URL вашого додатку.
3. Або підключіть Mini App: `/newapp`, URL `https://complaint-procare.github.io/0/`.

Для серверної валідації `initData` — додайте окрему Edge Function (поки не реалізовано).

---

## Робота з секретами

Gitignored локальні файли:

- **`.env.local`** — єдине місце для локальних app/deploy ключів.
- **`secrets.local.md`** — чек-лист секретів, якщо потрібен; не дублюйте там актуальні ключі.

`.env.local` **не комітиться** (перевірте через `git status`). Шаблон патернів — у `.gitignore`.

---

## Дизайн-токени

`tailwind.config.js`:
- фон: `hsl(40 12% 95%)` (теплий світло-сірий)
- бічна панель і картки: `#FFFFFF`
- `primary` / активний стан: `hsl(0 0% 8%)`
- pill-кольори в `src/index.css`: `.pill-good`, `.pill-warn`, `.pill-bad`, `.pill-neutral`
- кнопки — `rounded-full` капсули; картки — `rounded-2xl` з `shadow-card`

---

## Скрипти

| Команда         | Дія                              |
|-----------------|----------------------------------|
| `npm run dev`     | dev-сервер на 5173               |
| `npm run build`   | продакшен-збірка в `dist/`       |
| `npm run preview` | попередній перегляд збірки       |
| `npm run lint`    | TypeScript type-check            |
| `npm run check:supabase` | перевірка Supabase Auth, таблиць, Edge Function і Storage |
| `npm run deploy:supabase` | link/db push/seed/secrets/functions deploy через Supabase CLI |

## Залежності

- React 18, React Router 6
- TanStack Query 5, TanStack Table 8
- Tailwind 3
- `@supabase/supabase-js` 2
- `localforage` (IndexedDB-fallback)
- `lucide-react` (іконки)
- `xlsx` (експорт)
