// Supabase client. The app uses Supabase as the only persistent data store.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ComplaintAttachment } from './types'

const url     = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null

export const supabaseEnabled = supabase !== null

export async function uploadAttachment(complaintId: string, file: File, actorId: string) {
  if (!supabase) throw new Error('Supabase is not configured')

  const fd = new FormData()
  fd.append('complaint_id', complaintId)
  fd.append('uploaded_by', actorId)
  fd.append('file', file)

  const res = await fetch(`${url}/functions/v1/upload-attachment`, {
    method: 'POST',
    headers: {
      apikey: anonKey!,
      authorization: `Bearer ${anonKey!}`,
    },
    body: fd,
  })
  if (!res.ok) {
    const text = await res.text()
    let message = `upload failed: ${text}`
    try {
      const body = JSON.parse(text) as { error?: string }
      message = body.error ?? message
    } catch {
      // Keep raw response text when the function did not return JSON.
    }
    throw new Error(message)
  }
  return res.json() as Promise<{
    attachment: ComplaintAttachment
    folder_url: string
  }>
}
