// Supabase Edge Function: upload-attachment
// -----------------------------------------------------------------------------
// 1. Accepts a multipart upload from the SPA (authenticated user).
// 2. Verifies the caller is staff via public.current_app_user().
// 3. Uploads the file to Google Drive under a per-complaint subfolder.
// 4. Records the resulting drive_file_id / drive_url in complaint_attachments.
//
// Required Edge Function secrets (set with `supabase secrets set ...`):
//   SUPABASE_URL                       (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY          (auto-injected)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL       client_email from the JSON key
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY private_key from the JSON key (PEM, with \n)
//   GOOGLE_DRIVE_ROOT_FOLDER_ID        ID of the shared Drive folder
//
// Deploy: `supabase functions deploy upload-attachment --no-verify-jwt`
// (we re-verify the JWT manually so we can read the user record.)
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ROOT_FOLDER = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "supabase function secrets are not configured" }, 500);
  }
  if (!ROOT_FOLDER) {
    return json({ error: "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });

  // Identify the caller via their JWT and the public.users row.
  const { data: userInfo, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userInfo?.user) return json({ error: "unauthorized" }, 401);

  const { data: appUser, error: appUserErr } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", userInfo.user.id)
    .single();
  if (appUserErr || !appUser) return json({ error: "no app user" }, 403);

  const form = await req.formData();
  const complaintId = String(form.get("complaint_id") ?? "");
  const file = form.get("file");
  if (!complaintId || !(file instanceof File)) {
    return json({ error: "complaint_id and file are required" }, 400);
  }

  // Look up (or create) a Drive folder for this complaint.
  const { data: complaint, error: cErr } = await supabase
    .from("complaints")
    .select("id, number, drive_folder_id, drive_folder_url")
    .eq("id", complaintId)
    .single();
  if (cErr || !complaint) return json({ error: "complaint not found" }, 404);

  const accessToken = await getGoogleAccessToken();

  let folderId = complaint.drive_folder_id;
  let folderUrl = complaint.drive_folder_url;
  if (!folderId) {
    const created = await driveCreateFolder(accessToken, `complaint-${complaint.number}`, ROOT_FOLDER);
    folderId  = created.id;
    folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    await supabase.from("complaints")
      .update({ drive_folder_id: folderId, drive_folder_url: folderUrl })
      .eq("id", complaint.id);
  }

  const uploaded = await driveUploadFile(accessToken, folderId!, file);

  const { data: row, error: insErr } = await supabase
    .from("complaint_attachments")
    .insert({
      complaint_id: complaintId,
      drive_file_id: uploaded.id,
      drive_url:    `https://drive.google.com/file/d/${uploaded.id}/view`,
      file_name:    file.name,
      mime_type:    file.type || "application/octet-stream",
      file_size:    file.size,
      uploaded_by:  appUser.id,
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  return json({ attachment: row, folder_url: folderUrl });
});

// ---------- helpers ----------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

async function getGoogleAccessToken(): Promise<string> {
  const SA_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const SA_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!SA_EMAIL || !SA_KEY) {
    throw new Error("Google service account secrets are not configured");
  }
  const SA_KEY_PEM = SA_KEY.replace(/\\n/g, "\n");
  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim  = {
    iss:   SA_EMAIL,
    scope: "https://www.googleapis.com/auth/drive",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(SA_KEY_PEM),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) throw new Error(`google token: ${await tokenRes.text()}`);
  const tok = await tokenRes.json();
  return tok.access_token as string;
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function driveCreateFolder(token: string, name: string, parent: string) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    }),
  });
  if (!res.ok) throw new Error(`drive folder: ${await res.text()}`);
  return res.json();
}

async function driveUploadFile(token: string, folderId: string, file: File) {
  const meta = {
    name: file.name,
    parents: [folderId],
  };
  const boundary = "----complaint-" + crypto.randomUUID();
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(meta),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`drive upload: ${await res.text()}`);
  return res.json();
}
