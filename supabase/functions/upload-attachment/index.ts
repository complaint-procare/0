// Supabase Edge Function: upload-attachment
// -----------------------------------------------------------------------------
// 1. Accepts a multipart upload from the SPA after app-level PIN sign-in.
// 2. Verifies the supplied public.users id is an active staff user.
// 3. Uploads the file to Google Drive via OAuth tokens stored by
//    `google-oauth-callback` in app_secrets (key: drive.oauth).
// 4. Records the resulting drive_file_id / drive_url in complaint_attachments.
//
// Required Edge Function secrets:
//   SUPABASE_URL                (auto)
//   SUPABASE_SERVICE_ROLE_KEY   (auto)
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//
// Deploy: `supabase functions deploy upload-attachment --no-verify-jwt`
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "supabase function secrets are not configured" }, 500);
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json({ error: "google oauth client is not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const form = await req.formData();
    const complaintId = String(form.get("complaint_id") ?? "");
    const uploadedBy = String(form.get("uploaded_by") ?? "");
    const file = form.get("file");
    if (!complaintId || !uploadedBy || !(file instanceof File)) {
      return json({ error: "complaint_id, uploaded_by and file are required" }, 400);
    }

    const { data: appUser, error: appUserErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", uploadedBy)
      .eq("is_active", true)
      .single();
    if (appUserErr || !appUser) return json({ error: "no app user" }, 403);
    if (!["admin", "supervisor", "manager", "product_manager", "qa"].includes(appUser.role)) {
      return json({ error: "not staff" }, 403);
    }

    const { data: oauthRow } = await supabase
      .from("app_secrets")
      .select("value")
      .eq("key", "drive.oauth")
      .maybeSingle();
    const oauth = oauthRow?.value as { refresh_token?: string; root_folder_id?: string } | null;
    if (!oauth?.refresh_token || !oauth.root_folder_id) {
      return json({ error: "Google Drive не підключений. Зайдіть у Налаштування → Google Drive і підключіть акаунт." }, 503);
    }

    const { data: complaint, error: cErr } = await supabase
      .from("complaints")
      .select("id, number, drive_folder_id, drive_folder_url")
      .eq("id", complaintId)
      .single();
    if (cErr || !complaint) return json({ error: "complaint not found" }, 404);

    const accessToken = await refreshAccessToken(CLIENT_ID, CLIENT_SECRET, oauth.refresh_token);

    let folderId = complaint.drive_folder_id;
    let folderUrl = complaint.drive_folder_url;
    if (folderId?.startsWith("storage:")) {
      folderId = null;
      folderUrl = null;
    }
    if (!folderId) {
      const created = await driveCreateFolder(accessToken, `complaint-${complaint.number}`, oauth.root_folder_id);
      folderId = created.id;
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      await supabase.from("complaints")
        .update({ drive_folder_id: folderId, drive_folder_url: folderUrl })
        .eq("id", complaint.id);
    }

    const uploaded = await driveUploadFile(accessToken, folderId!, file);
    await driveShareAnyoneReader(accessToken, uploaded.id);

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
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`google refresh: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
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

async function driveUploadFile(token: string, folderId: string, file: File): Promise<{ id: string }> {
  const meta = { name: file.name, parents: [folderId] };
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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
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

async function driveShareAnyoneReader(token: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!res.ok) {
    // Non-fatal: file is uploaded, just won't be publicly previewable.
    console.warn(`drive permission: ${await res.text()}`);
  }
}
