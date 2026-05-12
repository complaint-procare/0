# Налаштування Google Drive для медіа-вкладень

Архітектура: SPA → Supabase Edge Function `upload-attachment` → Google Drive API.
Service account має доступ до спільної папки на Drive, а ключ ніколи не потрапляє в браузер.

## 1. Створити проєкт у Google Cloud

1. Відкрити [Google Cloud Console](https://console.cloud.google.com/).
2. Створити новий проєкт, напр. `complaint-procare`.
3. У навігації **APIs & Services → Library** знайти **Google Drive API** → **Enable**.

## 2. Створити Service Account

1. **APIs & Services → Credentials → Create credentials → Service account**.
2. Name: `complaint-uploader`. Натиснути **Create and continue**, ролі можна не додавати, **Done**.
3. На сторінці акаунта відкрити вкладку **Keys → Add key → Create new key → JSON**.
4. Завантажиться JSON-файл вигляду:
   ```json
   {
     "client_email": "complaint-uploader@complaint-procare.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n",
     ...
   }
   ```
   **Не комітити!** Файл уже у `.gitignore` (шаблон `**/service-account*.json`).

## 3. Створити спільну папку на Drive

1. У [Google Drive](https://drive.google.com/) створити папку, напр. `Complaints`.
2. **Share** → додати email сервісного акаунта (`client_email` з JSON) з роллю **Editor**.
3. Скопіювати ID папки з URL — це частина після `folders/`:
   `https://drive.google.com/drive/folders/`**`1A2b3C4d5E6f...`**

> Якщо ваш Google Workspace дозволяє Shared Drives — створіть Shared Drive і додайте
> сервісний акаунт як **Content manager**. Тоді файли не «належать» сервісному акаунту,
> а живуть на корпоративному диску.

## 4. Прокинути секрети в Supabase

Через Supabase CLI (з кореня репозиторію):

```bash
supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_EMAIL='complaint-uploader@complaint-procare.iam.gserviceaccount.com' \
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(jq -r .private_key < service-account.json)" \
  GOOGLE_DRIVE_ROOT_FOLDER_ID='1A2b3C4d5E6f...'
```

Або вручну в **Supabase Studio → Project settings → Edge Functions → Secrets**.

Перевірка:
```bash
supabase secrets list
```

## 5. Задеплоїти Edge Function

```bash
supabase functions deploy upload-attachment --no-verify-jwt
```

(`--no-verify-jwt`, бо функція сама перевіряє токен через `supabase.auth.getUser()`
і додатково мапить його на `public.users.auth_id`.)

GitHub Action `.github/workflows/supabase-migrate.yml` робить це автоматично при пуші в `main`,
якщо налаштовано секрет `SUPABASE_ACCESS_TOKEN`.

## 6. Як це працює у застосунку

```ts
import { uploadAttachment } from '@/lib/supabase'

const { attachment, folder_url } = await uploadAttachment(complaintId, file)
// attachment.drive_url — пряме посилання на файл у Drive
// folder_url          — папка скарги (зберігається в complaints.drive_folder_url)
```

Послідовність:

1. Edge function через JWT знаходить `public.users` запис.
2. Якщо у `complaints.drive_folder_id` ще немає папки — створює `complaint-<number>`
   усередині `GOOGLE_DRIVE_ROOT_FOLDER_ID` і записує `drive_folder_id` / `drive_folder_url`.
3. Завантажує файл туди ж через `multipart/related`.
4. Створює рядок у `complaint_attachments` із `drive_file_id` та `drive_url`.

## 7. Резервна копія через Supabase Storage (опційно)

Якщо хочете дзеркало в Supabase Storage — у функції додайте:
```ts
await supabase.storage
  .from('complaint-media')
  .upload(`${complaintId}/${uploaded.id}-${file.name}`, file)
```
Бакет `complaint-media` уже створений міграцією `20260512000002_storage.sql`.

## 8. Чек-лист безпеки

- [ ] JSON-ключ ніколи не комітиться (перевірте `git status`).
- [ ] У браузер не йде `service_role` ключ — використовуємо лише `anon`.
- [ ] Edge function переvirile, що `uploaded_by` = поточний `public.users.id`.
- [ ] У Drive UI права на папку: лише service account та потрібні рев'ювери.
- [ ] Раз на квартал ротувати приватний ключ (Keys → Add key, потім видалити старий).
