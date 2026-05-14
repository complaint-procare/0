# Deployment

## GitHub Pages

1. **Settings → Pages → Source: GitHub Actions.**
2. Push у `main` запускає `.github/workflows/deploy.yml`:
   - `npm ci`
   - перевірка frontend env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_OAUTH_CLIENT_ID`)
   - `npm run build`
   - бандлинг із `base = /<repo>/` через `VITE_BASE_PATH`
   - `scripts/create-spa-route-pages.mjs` створює `404.html` і статичні entry pages для основних React routes
   - публікує `dist/` через `actions/deploy-pages@v4`
3. URL: `https://complaint-procare.github.io/0/`

GitHub Pages не підтримує wildcard routes. Тому `/0/complaints`, `/0/login`, `/0/settings/users` мають статичні entry pages і повертають `200`, а динамічні прямі URL на кшталт `/0/complaints/<id>` рендеряться через `404.html` і можуть мати HTTP `404`, хоча SPA після завантаження відкриє потрібний React route.

### Repo Variables / Secrets

Settings → Secrets and variables → Actions.

| Type | Name | Used for |
|---|---|---|
| Variable | `SUPABASE_URL` | `VITE_SUPABASE_URL` у frontend build |
| Variable | `SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` у frontend build |
| Variable | `GOOGLE_OAUTH_CLIENT_ID` | `VITE_GOOGLE_OAUTH_CLIENT_ID` у frontend build |
| Variable | `SUPABASE_PROJECT_REF` | `supabase link` |
| Secret | `SUPABASE_ACCESS_TOKEN` | Supabase CLI deploy |
| Secret | `SUPABASE_DB_PASSWORD` | `supabase db push` |
| Secret | `GOOGLE_OAUTH_CLIENT_ID` | Edge Function OAuth client id |
| Secret | `GOOGLE_OAUTH_CLIENT_SECRET` | Edge Function OAuth client secret |

`SUPABASE_ANON_KEY` і Google OAuth client id не є service-role secrets: вони потрапляють у browser bundle як `VITE_*`, тому для frontend workflow вони зберігаються як repo variables. Edge Function client secret залишається тільки у GitHub/Supabase secrets.

## Supabase

Локально:

```bash
supabase login
supabase link --project-ref <ref>
supabase db push
supabase db query --linked --file supabase/seed.sql
```

У CI це робить `.github/workflows/supabase-migrate.yml` при змінах у `supabase/`.

### Edge Functions

```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=... \
                     GOOGLE_OAUTH_CLIENT_SECRET=...
supabase functions deploy upload-attachment --no-verify-jwt
supabase functions deploy google-oauth-callback --no-verify-jwt
```

`GOOGLE_OAUTH_CLIENT_ID` і `GOOGLE_OAUTH_CLIENT_SECRET` обов’язкові для Edge Functions. CI падає, якщо вони не задані, щоб не деплоїти uploads/OAuth у напівзламаному стані.

Деталі: [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

## Локально

```bash
npm install
cp .env.example .env.local
npm run dev       # http://localhost:5173
npm run build
npm run preview
```

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` і `VITE_GOOGLE_OAUTH_CLIENT_ID` потрібні у `.env.local`. Офлайн/IndexedDB режим вимкнено.

Для першого admin у порожній БД:

```bash
npm run create:admin -- "Admin User" 1234
```
