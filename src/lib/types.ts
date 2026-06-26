export type Role = 'manager' | 'supervisor' | 'admin' | 'product_manager' | 'qa'

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Менеджер',
  supervisor: 'Керівник',
  admin: 'Адміністратор',
  product_manager: 'Продакт-менеджер',
  qa: 'ВКЯ',
}

export interface User {
  id: string
  auth_id: string | null
  full_name: string
  role: Role
  pin_hash: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Brand {
  id: string
  name: string
  color: string
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  external_id: string | null
  brand_id: string | null
  name: string
  sku: string | null
  is_active: boolean
  created_at: string
}

export interface RetailNetwork {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Client {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface ComplaintStatus {
  id: string
  name: string
  sort_order: number
  color: string
  is_closed: boolean
  is_active: boolean
}

export interface SeverityLevel {
  id: string
  name: string
  sort_order: number
  color: string
  is_active: boolean
}

export interface ComplaintGroup {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'reference'

export interface EntityDefinition {
  id: string
  entity_key: string
  singular_label: string
  plural_label: string
  icon?: string
  sort_order: number
  show_in_navigation: boolean
  is_system: boolean
  is_active: boolean
  is_visible: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface FieldDefinition {
  id: string
  entity_id: string
  field_key: string
  label: string
  field_type: FieldType
  reference_entity_id: string | null
  is_system: boolean
  is_required: boolean
  is_active: boolean
  is_visible: boolean
  show_in_create: boolean
  show_in_details: boolean
  show_in_registry: boolean
  sort_order: number
  options: string[] | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface EntityRecord {
  id: string
  entity_id: string
  display_name: string
  data: Record<string, unknown>
  is_active: boolean
  is_visible: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Complaint {
  id: string
  number: number
  created_at: string
  created_by: string
  manager_id: string
  source_type: 'network' | 'client'
  retail_network_id: string | null
  client_phone: string
  brand_id: string | null
  product_name: string
  product_barcode: string
  batch_number: string
  complaint_group_id: string | null
  problem_description: string
  resolution_response: string
  severity_id: string | null
  status_id: string | null
  drive_folder_id?: string | null
  drive_folder_url?: string | null
  closed_at?: string | null
  updated_at: string
  custom_fields: Record<string, unknown>
}

export interface ComplaintSummaryRow {
  complaint_id: string
  complaint_number: number
  complaint_created_at: string
  created_by_id: string
  created_by_name: string
  product_name: string
  description: string
  resend_requested_at: string | null
  synced_at: string
}

export interface ComplaintViewCount {
  complaint_id: string
  unique_views: number
}

export interface ComplaintAttachment {
  id: string
  complaint_id: string
  drive_file_id: string
  drive_url: string
  file_name: string
  mime_type: string
  file_size: number
  uploaded_by: string | null
  is_deleted: boolean
  created_at: string
  deleted_at?: string | null
  deleted_by?: string | null
}

export type ChangeLogEventType =
  | 'created'
  | 'field_updated'
  | 'status_changed'
  | 'reopened'
  | 'file_added'
  | 'file_deleted'

export interface ComplaintChangeLog {
  id: string
  complaint_id: string
  actor_id: string | null
  event_type: ChangeLogEventType
  field_name: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

export interface AppSetting {
  key: string
  value: unknown
  updated_at: string
  updated_by: string | null
}

export interface AuthSession {
  user_id: string
  full_name: string
  role: Role
  signed_in_at: string
}
