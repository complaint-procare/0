import { supabase } from './supabase'
import type {
  AppSetting,
  AuthSession,
  BoxRecord,
  Brand,
  Client,
  Complaint,
  ComplaintAttachment,
  ComplaintChangeLog,
  ComplaintGroup,
  ComplaintSummaryRow,
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
  complaint_groups: ComplaintGroup
  entity_definitions: EntityDefinition
  entity_records: EntityRecord
  field_definitions: FieldDefinition
  complaints: Complaint
  complaint_summary_rows: ComplaintSummaryRow
  complaint_attachments: ComplaintAttachment
  complaint_change_log: ComplaintChangeLog
  app_settings: AppSetting
  boxes: BoxRecord
}

export type TableName = keyof Tables

const SESSION_KEY = '__auth_session__'
const DEFAULT_BRAND_COLOR = '#64748B'

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
  return normalizeRows(table, data ?? [])
}

export async function getById<T extends TableName>(
  table: T,
  id: string,
): Promise<Tables[T] | undefined> {
  const client = requireSupabase()
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? normalizeRow(table, data) : undefined
}

export async function insert<T extends TableName>(
  table: T,
  row: Partial<Tables[T]>,
): Promise<Tables[T]> {
  const client = requireSupabase()
  const { data, error } = await client.from(table).insert(row as never).select('*').single()
  if (!error) return normalizeRow(table, data)
  if (isMissingBrandColorColumnError(table, error)) {
    const { data: retryData, error: retryError } = await client
      .from(table)
      .insert(omitBrandColor(row) as never)
      .select('*')
      .single()
    if (retryError) throw retryError
    return normalizeRow(table, retryData)
  }
  throw error
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
  if (!error) return data ? normalizeRow(table, data) : undefined
  if (isMissingBrandColorColumnError(table, error)) {
    const fallbackPatch = omitBrandColor(patch)
    if (Object.keys(fallbackPatch).length === 0) return getById(table, id)
    const { data: retryData, error: retryError } = await client
      .from(table)
      .update(fallbackPatch as never)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (retryError) throw retryError
    return retryData ? normalizeRow(table, retryData) : undefined
  }
  throw error
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

function normalizeRows<T extends TableName>(table: T, rows: unknown[]): Tables[T][] {
  return rows.map((row) => normalizeRow(table, row))
}

function normalizeRow<T extends TableName>(table: T, row: unknown): Tables[T] {
  if (table === 'brands' && row && typeof row === 'object' && !('color' in row)) {
    return { ...(row as Record<string, unknown>), color: DEFAULT_BRAND_COLOR } as Tables[T]
  }
  return row as Tables[T]
}

function omitBrandColor<T extends TableName>(row: Partial<Tables[T]>) {
  const { color: _color, ...rest } = row as Partial<Brand>
  return rest
}

function isMissingBrandColorColumnError<T extends TableName>(table: T, error: { message?: string; code?: string }) {
  return (
    table === 'brands' &&
    error.code === 'PGRST204' &&
    /'color' column of 'brands'|Could not find the 'color' column/i.test(error.message ?? '')
  )
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = window.localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as AuthSession) : null
}

export async function setSession(session: AuthSession | null) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else window.localStorage.removeItem(SESSION_KEY)
}
