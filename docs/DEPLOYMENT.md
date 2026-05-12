# Deployment

## GitHub Pages

1. **Settings → Pages → Source: GitHub Actions.**
2. Перший пуш у `main` запустить `.github/workflows/deploy.yml`:
   - `npm ci && npm run build`
   - бандлинг із `base = /<repo>/` (бере з `VITE_BASE_PATH`)
   - копіює `index.html` → `404.html` (SPA fallback для React Router)
   - публікує `dist/` через `actions/deploy-pages@v4`
3. URL: `https://complaint-procare.github.io/0/`

### Repo змінні / секрети (Settings → Secrets and variables → Actions)

| Тип       | Імʼя                  | Значення                                                |
|-----------|-----------------------|---------------------------------------------------------|
| Variable  | `SUPABASE_URL`        | `https://<ref>.supabase.co`                             |
| Secret    | `SUPABASE_ANON_KEY`   | anon публічний ключ                                     |
| Variable  | `SUPABASE_PROJECT_REF`| ref проєкту (для `supabase link`)                       |
| Secret    | `SUPABASE_ACCESS_TOKEN`| personal access token (`supabase login --token`)       |
| Secret    | `SUPABASE_DB_PASSWORD`| пароль БД проєкту                                       |

## Supabase

Локально:
```bash
supabase login
supabase link --project-ref <ref>
supabase db push       # застосовує міграції з supabase/migrations/
supabase db seed       # виконує supabase/seed.sql (опційно)
```

В CI це робить `.github/workflows/supabase-migrate.yml` при змінах у `supabase/`.

### Edge Function

```bash
supabase functions deploy upload-attachment --no-verify-jwt
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
                     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(jq -r .private_key key.json)" \
                     GOOGLE_DRIVE_ROOT_FOLDER_ID=...
```

Деталі — [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

## Локально

```bash
npm install
cp .env.example .env.local      # підставити VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                     # http://localhost:5173
npm run build                   # збірка
npm run preview                 # перевірка production-збірки
```

Якщо `VITE_SUPABASE_*` порожні — додаток працює офлайн на IndexedDB (як до міграції).
