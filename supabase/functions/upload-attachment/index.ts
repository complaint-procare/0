// Supabase Edge Function: upload-attachment
// -----------------------------------------------------------------------------
// 1. Accepts a multipart upload from the SPA after app-level PIN sign-in.
// 2. Verifies the supplied public.users id is an active staff user.
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
// (JWT verification is disabled because the app uses PIN auth, not Supabase Auth.)
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
  const ROOT_FOLDER = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "supabase function secrets are not configured" }, 500);
  }
  if (!ROOT_FOLDER) {
    return json({ error: "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured" }, 500);
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

  // Look up (or create) a Drive folder for this complaint.
  const { data: complaint, error: cErr } = await supabase
    .from("complaints")
    .select("id, number, drive_folder_id, drive_folder_url")
    .eq("id", complaintId)
    .single();
  if (cErr || !complaint) return json({ error: "complaint not found" }, 404);

  const uploaded = await uploadFile(supabase, complaint, file, ROOT_FOLDER);

  const { data: row, error: insErr } = await supabase
    .from("complaint_attachments")
    .insert({
      complaint_id: complaintId,
      drive_file_id: uploaded.id,
      drive_url:    uploaded.url,
      file_name:    file.name,
      mime_type:    file.type || "application/octet-stream",
      file_size:    file.size,
      uploaded_by:  appUser.id,
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

    return json({ attachment: row, folder_url: uploaded.folderUrl });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ---------- helpers ----------

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  complaint: { id: string; number: number; drive_folder_id: string | null; drive_folder_url: string | null },
  file: File,
  rootFolder: string,
) {
  try {
    const accessToken = await getGoogleAccessToken();

    let folderId = complaint.drive_folder_id;
    let folderUrl = complaint.drive_folder_url;
    if (!folderId || folderId.startsWith("storage:")) {
      const created = await driveCreateFolder(accessToken, `complaint-${complaint.number}`, rootFolder);
      folderId = created.id;
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      await supabase.from("complaints")
        .update({ drive_folder_id: folderId, drive_folder_url: folderUrl })
        .eq("id", complaint.id);
    }

    const uploaded = await driveUploadFile(accessToken, folderId!, file);
    return {
      id: uploaded.id as string,
      url: `https://drive.google.com/file/d/${uploaded.id}/view`,
      folderUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Service Accounts do not have storage quota")) throw error;
    return uploadToSupabaseStorage(supabase, complaint, file);
  }
}

async function uploadToSupabaseStorage(
  supabase: ReturnType<typeof createClient>,
  complaint: { id: string; number: number },
  file: File,
) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^A-Za-z0-9]/g, "") : "";
  const safeName = extension ? `attachment.${extension}` : "attachment";
  const path = `${complaint.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("complaint-media")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(`storage upload: ${uploadError.message}`);

  const { data, error: signedUrlError } = await supabase.storage
    .from("complaint-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signedUrlError) throw new Error(`storage signed url: ${signedUrlError.message}`);

  await supabase.from("complaints")
    .update({
      drive_folder_id: `storage:${complaint.id}`,
      drive_folder_url: null,
    })
    .eq("id", complaint.id);

  return {
    id: `storage:${path}`,
    url: data.signedUrl,
    folderUrl: null,
  };
}

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
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
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
