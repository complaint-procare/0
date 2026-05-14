import { supabaseEnabled } from './supabase'

export async function ensureSeed() {
  if (supabaseEnabled) return
  throw new Error('Supabase is required. Local seed is disabled.')
}
