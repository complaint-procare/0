import type {
  Complaint,
  ComplaintAttachment,
  ComplaintGroup,
  ComplaintStatus,
  ComplaintViewCount,
  FieldDefinition,
  SeverityLevel,
} from '@/lib/types'

export interface ComplaintRegistryFilters {
  statusId: string
  severityId: string
  groupId: string
  brandId: string
  networkId: string
  sourceType: '' | 'network' | 'client'
  managerId: string
  from: string
  to: string
  search: string
}

export const EMPTY_REGISTRY_FILTERS: ComplaintRegistryFilters = {
  statusId: '',
  severityId: '',
  groupId: '',
  brandId: '',
  networkId: '',
  sourceType: '',
  managerId: '',
  from: '',
  to: '',
  search: '',
}

export interface ComplaintRegistryData {
  complaints: Complaint[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  groups: ComplaintGroup[]
  brands: { id: string; name: string }[]
  networks: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
  attachments: ComplaintAttachment[]
  viewCounts: ComplaintViewCount[]
  entities: { id: string; entity_key: string }[]
  fields: FieldDefinition[]
}

export type RegistryField = Pick<
  FieldDefinition,
  'field_key' | 'label' | 'field_type' | 'sort_order'
>

export const DEFAULT_REGISTRY_FIELDS: RegistryField[] = [
  { field_key: 'number', label: '№', field_type: 'text', sort_order: 10 },
  { field_key: 'created_at', label: 'Дата', field_type: 'date', sort_order: 20 },
  { field_key: 'source_type', label: 'Джерело', field_type: 'select', sort_order: 45 },
  { field_key: 'brand_id', label: 'Бренд', field_type: 'reference', sort_order: 60 },
  { field_key: 'product_name', label: 'Продукт', field_type: 'text', sort_order: 70 },
  { field_key: 'product_barcode', label: 'Штрихкод', field_type: 'text', sort_order: 75 },
  { field_key: 'batch_number', label: 'Партія', field_type: 'text', sort_order: 80 },
  { field_key: 'complaint_group_id', label: 'Група', field_type: 'reference', sort_order: 85 },
  { field_key: 'manager_id', label: 'Менеджер', field_type: 'reference', sort_order: 90 },
  { field_key: 'problem_description', label: 'Опис', field_type: 'textarea', sort_order: 100 },
  {
    field_key: 'resolution_response',
    label: 'Рішення / Відповідь',
    field_type: 'textarea',
    sort_order: 105,
  },
  { field_key: 'severity_id', label: 'Критичність', field_type: 'reference', sort_order: 110 },
  { field_key: 'status_id', label: 'Статус', field_type: 'reference', sort_order: 120 },
]
