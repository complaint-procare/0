import { supabase } from './supabase'
import type {
  AppSetting,
  AuthSession,
  Brand,
  Client,
  Complaint,
  ComplaintAttachment,
  ComplaintChangeLog,
  ComplaintStatus,
  EntityDefinition,
  EntityRecord,
  FieldDefinition,
  Product,
  RetailNetwork,
  SeverityLevel,
  User,
} from './types'

type Tables = {
  users: User
  brands: Brand
  products: Product
  retail_networks: RetailNetwork
  clients: Client
  complaint_statuses: ComplaintStatus
  severity_levels: SeverityLevel
  entity_definitions: EntityDefinition
  entity_records: EntityRecord
  field_definitions: FieldDefinition
  complaints: Complaint
  complaint_attachments: ComplaintAttachment
  complaint_change_log: ComplaintChangeLog
  app_settings: AppSetting
}

export type TableName = keyof Tables

const SESSION_KEY = '__auth_session__'

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app.',
    )
  }
  return supabase
}

export async function list<T extends TableName>(table: T): Promise<Tables[T][]> {
  const client = requireSupabase()
  const { data, error } = await client.from(table).select('*')
  if (error) throw error
  return (data ?? []) as Tables[T][]
}

export async function getById<T extends TableName>(
  table: T,
  id: string,
): Promise<Tables[T] | undefined> {
  const client = requireSupabase()
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data ?? undefined) as Tables[T] | undefined
}

export async function insert<T extends TableName>(
  table: T,
  row: Partial<Tables[T]>,
): Promise<Tables[T]> {
  const client = requireSupabase()
  const { data, error } = await client.from(table).insert(row as never).select('*').single()
  if (error) throw error
  return data as Tables[T]
}

export async function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Tables[T]>,
): Promise<Tables[T] | undefined> {
  const client = requireSupabase()
  const { data, error } = await client
    .from(table)
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data ?? undefined) as Tables[T] | undefined
}

export async function remove<T extends TableName>(table: T, id: string): Promise<boolean> {
  const client = requireSupabase()
  const { error } = await client.from(table).delete().eq('id', id)
  if (error) throw error
  return true
}

export async function upsertSetting(key: string, value: unknown, userId: string | null) {
  const client = requireSupabase()
  const row: AppSetting = {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }
  const { data, error } = await client
    .from('app_settings')
    .upsert(row, { onConflict: 'key' })
    .select('*')
    .single()
  if (error) throw error
  return data as AppSetting
}

export async function getSetting(key: string): Promise<AppSetting | undefined> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('app_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return (data ?? undefined) as AppSetting | undefined
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = window.localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as AuthSession) : null
}

export async function setSession(session: AuthSession | null) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else window.localStorage.removeItem(SESSION_KEY)
}
