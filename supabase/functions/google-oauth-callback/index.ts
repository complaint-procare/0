// Supabase Edge Function: google-oauth-callback
// -----------------------------------------------------------------------------
// Receives the OAuth ?code from Google, exchanges it for tokens, creates the
// "Complaints" root folder in the user's Drive (if needed), and stores:
//   - refresh_token, root_folder_id in app_secrets (key: drive.oauth)
//   - sanitized status (email, folder name, connected_at) in app_settings
//     (key: drive.connection)
//
// Required Edge Function secrets:
//   SUPABASE_URL                (auto)
//   SUPABASE_SERVICE_ROLE_KEY   (auto)
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//
// Deploy: `supabase functions deploy google-oauth-callback --no-verify-jwt`
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ROOT_FOLDER_NAME = "Complaints";
const ALLOWED_ORIGINS = [
  "http://localhost:5174",
  "http://localhost:5173",
  "https://complaint-procare.github.io",
];

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") ?? "";
  const errParam = url.searchParams.get("error");

  const state = decodeState(stateRaw);
  const returnTo = pickReturnTo(state.return_to);

  if (errParam) return redirect(returnTo, { drive: "error", reason: errParam });
  if (!code) return redirect(returnTo, { drive: "error", reason: "missing_code" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return redirect(returnTo, { drive: "error", reason: "secrets_missing" });
    }
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // 1. Exchange auth code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return redirect(returnTo, { drive: "error", reason: `token_${tokenRes.status}` });
    }
    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!tokens.refresh_token) {
      return redirect(returnTo, { drive: "error", reason: "no_refresh_token" });
    }

    // 2. Fetch connected user's email.
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const email = profile?.email ?? "unknown";

    // 3. Ensure root folder exists.
    const folderId = await ensureRootFolder(tokens.access_token);

    // 4. Persist tokens + status.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const now = new Date().toISOString();

    await supabase.from("app_secrets").upsert({
      key: "drive.oauth",
      value: {
        refresh_token: tokens.refresh_token,
        root_folder_id: folderId,
      },
      updated_at: now,
    });

    await supabase.from("app_settings").upsert({
      key: "drive.connection",
      value: {
        connected: true,
        email,
        folder_name: ROOT_FOLDER_NAME,
        folder_id: folderId,
        connected_at: now,
      },
      updated_at: now,
    });

    return redirect(returnTo, { drive: "connected" });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return redirect(returnTo, { drive: "error", reason: reason.slice(0, 120) });
  }
});

function decodeState(raw: string): { return_to?: string } {
  try {
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function pickReturnTo(candidate?: string): string {
  const fallback = ALLOWED_ORIGINS[0] + "/settings/general";
  if (!candidate) return fallback;
  try {
    const u = new URL(candidate);
    const origin = `${u.protocol}//${u.host}`;
    if (ALLOWED_ORIGINS.includes(origin)) return candidate;
  } catch { /* ignore */ }
  return fallback;
}

function redirect(target: string, params: Record<string, string>) {
  const u = new URL(target);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: u.toString() } });
}

async function ensureRootFolder(accessToken: string): Promise<string> {
  // Look for an existing top-level "Complaints" folder owned by user, created by this app.
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (listRes.ok) {
    const data = await listRes.json() as { files?: { id: string; name: string }[] };
    if (data.files?.length) return data.files[0].id;
  }
  // Otherwise create a new folder in the user's My Drive root.
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) throw new Error(`drive folder create: ${await createRes.text()}`);
  const folder = await createRes.json();
  return folder.id as string;
}
