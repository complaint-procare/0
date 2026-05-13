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
| Secret    | `SUPABASE_ANON_KEY`   | anon/publishable key для frontend build                 |
| Variable  | `SUPABASE_PROJECT_REF`| ref проєкту (для `supabase link`)                       |
| Secret    | `SUPABASE_ACCESS_TOKEN`| personal access token (`supabase login --token`)       |
| Secret    | `SUPABASE_DB_PASSWORD`| пароль БД проєкту                                       |
| Secret    | `GOOGLE_OAUTH_CLIENT_ID`| Google OAuth Web client ID для frontend і Edge Functions |
| Secret    | `GOOGLE_OAUTH_CLIENT_SECRET`| Google OAuth Web client secret                    |

## Supabase

Локально:
```bash
supabase login
supabase link --project-ref <ref>
supabase db push       # застосовує міграції з supabase/migrations/
supabase db query --linked --file supabase/seed.sql  # виконує supabase/seed.sql (опційно)
```

В CI це робить `.github/workflows/supabase-migrate.yml` при змінах у `supabase/`.

### Edge Function

```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=... \
                     GOOGLE_OAUTH_CLIENT_SECRET=...
supabase functions deploy upload-attachment --no-verify-jwt
supabase functions deploy google-oauth-callback --no-verify-jwt
```

Деталі — [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

## Локально

```bash
npm install
cp .env.example .env.local      # підставити VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_GOOGLE_OAUTH_CLIENT_ID
npm run dev                     # http://localhost:5173
npm run build                   # збірка
npm run preview                 # перевірка production-збірки
```

`VITE_SUPABASE_URL` і `VITE_SUPABASE_ANON_KEY` обовʼязкові: офлайн-режим вимкнено.
