import localforage from 'localforage'
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

localforage.config({
  name: 'complaint-crm',
  storeName: 'main',
  description: 'Local-only data store for Complaint CRM',
})

const ATTACHMENTS_STORE = localforage.createInstance({
  name: 'complaint-crm',
  storeName: 'attachments_blob',
})

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

async function readTable<T extends TableName>(table: T): Promise<Tables[T][]> {
  const data = await localforage.getItem<Tables[T][]>(table)
  return data ?? []
}

async function writeTable<T extends TableName>(table: T, rows: Tables[T][]): Promise<void> {
  await localforage.setItem(table, rows)
}

export async function list<T extends TableName>(table: T): Promise<Tables[T][]> {
  return readTable(table)
}

export async function getById<T extends TableName>(
  table: T,
  id: string,
): Promise<Tables[T] | undefined> {
  const rows = await readTable(table)
  return rows.find((r) => (r as { id?: string }).id === id) as Tables[T] | undefined
}

export async function insert<T extends TableName>(table: T, row: Tables[T]): Promise<Tables[T]> {
  const rows = await readTable(table)
  rows.push(row)
  await writeTable(table, rows)
  return row
}

export async function update<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<Tables[T]>,
): Promise<Tables[T] | undefined> {
  const rows = await readTable(table)
  const idx = rows.findIndex((r) => (r as { id?: string }).id === id)
  if (idx === -1) return undefined
  rows[idx] = { ...rows[idx], ...patch } as Tables[T]
  await writeTable(table, rows)
  return rows[idx]
}

export async function remove<T extends TableName>(table: T, id: string): Promise<boolean> {
  const rows = await readTable(table)
  const next = rows.filter((r) => (r as { id?: string }).id !== id)
  if (next.length === rows.length) return false
  await writeTable(table, next)
  return true
}

export async function upsertSetting(key: string, value: unknown, userId: string | null) {
  const rows = await readTable('app_settings')
  const idx = rows.findIndex((r) => r.key === key)
  const row: AppSetting = {
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }
  if (idx === -1) rows.push(row)
  else rows[idx] = row
  await writeTable('app_settings', rows)
  return row
}

export async function getSetting(key: string): Promise<AppSetting | undefined> {
  const rows = await readTable('app_settings')
  return rows.find((r) => r.key === key)
}

const SESSION_KEY = '__auth_session__'

export async function getSession(): Promise<AuthSession | null> {
  return (await localforage.getItem<AuthSession>(SESSION_KEY)) ?? null
}

export async function setSession(session: AuthSession | null) {
  if (session) await localforage.setItem(SESSION_KEY, session)
  else await localforage.removeItem(SESSION_KEY)
}

export async function saveAttachmentBlob(id: string, file: Blob) {
  await ATTACHMENTS_STORE.setItem(id, file)
}

export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  return (await ATTACHMENTS_STORE.getItem<Blob>(id)) ?? null
}

export async function deleteAttachmentBlob(id: string) {
  await ATTACHMENTS_STORE.removeItem(id)
}

export async function nextComplaintNumber(): Promise<number> {
  const rows = await readTable('complaints')
  const max = rows.reduce((acc, c) => Math.max(acc, c.number ?? 0), 0)
  return max + 1
}

export async function wipeAll() {
  await localforage.clear()
  await ATTACHMENTS_STORE.clear()
}
