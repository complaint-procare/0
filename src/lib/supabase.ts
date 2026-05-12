// Supabase client. Used by the data layer when env vars are configured.
// If `VITE_SUPABASE_URL` is empty the app keeps using the IndexedDB store in db.ts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url     = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null

export const supabaseEnabled = supabase !== null

export async function uploadAttachment(complaintId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured')
  const session = await supabase.auth.getSession()
  const token   = session.data.session?.access_token
  if (!token) throw new Error('not signed in')

  const fd = new FormData()
  fd.append('complaint_id', complaintId)
  fd.append('file', file)

  const res = await fetch(`${url}/functions/v1/upload-attachment`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  })
  if (!res.ok) throw new Error(`upload failed: ${await res.text()}`)
  return res.json() as Promise<{
    attachment: {
      id: string
      drive_file_id: string
      drive_url: string
      file_name: string
      mime_type: string
      file_size: number
    }
    folder_url: string
  }>
}
