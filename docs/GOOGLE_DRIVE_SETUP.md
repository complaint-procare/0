# Налаштування Google Drive для медіа-вкладень

Архітектура: SPA → Google OAuth → Supabase Edge Function `google-oauth-callback` → `app_secrets` → Edge Function `upload-attachment` → Google Drive API.

Додаток працює від імені реального Google-користувача через OAuth refresh token і створює папку `Complaints` у його My Drive.

## 1. Google Cloud

1. Відкрити [Google Cloud Console](https://console.cloud.google.com/).
2. У проєкті `complaints-496120` увімкнути **Google Drive API**.
3. Налаштувати **OAuth consent**:
   - User type: External
   - Publishing status для тесту: Testing
   - Test users: додати потрібні Google-акаунти
   - Scopes: `auth/drive.file`, `auth/userinfo.email`

## 2. OAuth Client

Створити або перевірити OAuth Client ID типу **Web application**.

Authorized redirect URI:

```text
https://ihjvjwzomrbyitubovsg.supabase.co/functions/v1/google-oauth-callback
```

Frontend використовує тільки public client id:

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=000000000000-xxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

Client secret має бути тільки в Supabase Edge Function secrets.

## 3. Supabase Secrets

Через Supabase CLI:

```bash
supabase secrets set \
  GOOGLE_OAUTH_CLIENT_ID='000000000000-xxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com' \
  GOOGLE_OAUTH_CLIENT_SECRET='GOCSPX-...'
```

Або через GitHub Actions secrets:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

Workflow `.github/workflows/supabase-migrate.yml` перед деплоєм Edge Functions прокидає ці секрети в Supabase, якщо вони задані.

## 4. Edge Functions

Потрібні дві функції:

```bash
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy upload-attachment --no-verify-jwt
```

`google-oauth-callback` приймає `code` від Google, обмінює його на токени, створює або знаходить папку `Complaints`, зберігає refresh token і root folder id у `public.app_secrets`, а публічний статус підключення у `public.app_settings`.

`upload-attachment` бере refresh token з `app_secrets`, оновлює access token, створює папку `complaint-<номер>` і завантажує файл у Drive.

## 5. Як підключити Drive в UI

1. Увійти в CRM як admin.
2. Відкрити `/settings/general`.
3. Натиснути **Підключити Google Drive**.
4. Надати доступ у Google.
5. Після callback сторінка має показати підключений email і папку `Complaints`.

## 6. Чек-лист безпеки

- [ ] У браузер іде тільки `VITE_GOOGLE_OAUTH_CLIENT_ID`, без client secret.
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` заданий тільки в Supabase/GitHub secrets.
- [ ] `public.app_secrets` не має grants для `anon` або `authenticated`.
- [ ] `upload-attachment` перевіряє `uploaded_by` проти активного `public.users`.
- [ ] Для production опублікувати Google OAuth app, інакше Testing refresh token може мати обмежений строк життя.
