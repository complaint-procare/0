import { useMemo } from 'react'
import { Card } from '@/components/ui/primitives'
import { formatDate } from '@/lib/utils'
import type {
  ComplaintChangeLog,
  ComplaintGroup,
  ComplaintStatus,
  SeverityLevel,
  User,
} from '@/lib/types'

const FIELD_LABELS: Record<string, string> = {
  source_type: 'Тип джерела',
  retail_network_id: 'Торгова мережа',
  client_phone: 'Телефон клієнта',
  brand_id: 'Бренд',
  product_name: 'Назва продукту',
  product_barcode: 'Штрихкод',
  batch_number: 'Номер партії',
  complaint_group_id: 'Група скарги',
  problem_description: 'Суть претензії',
  resolution_response: 'Рішення / Відповідь',
  severity_id: 'Критичність',
  status_id: 'Статус',
  manager_id: 'Менеджер',
}

const HIDDEN_FIELDS = new Set(['closed_at', 'updated_at'])

export function ComplaintChangeLogCard({
  log,
  users,
  statuses,
  severities,
  groups,
  brands,
  networks,
}: {
  log: ComplaintChangeLog[]
  users: User[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  groups: ComplaintGroup[]
  brands: { id: string; name: string }[]
  networks: { id: string; name: string }[]
}) {
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user.full_name])), [users])
  const lookups = {
    userMap,
    statusMap: useMemo(() => new Map(statuses.map((status) => [status.id, status.name])), [statuses]),
    severityMap: useMemo(
      () => new Map(severities.map((severity) => [severity.id, severity.name])),
      [severities],
    ),
    groupMap: useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]),
    brandMap: useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]),
    networkMap: useMemo(
      () => new Map(networks.map((network) => [network.id, network.name])),
      [networks],
    ),
  }
  const visible = log.filter((event) => !(event.field_name && HIDDEN_FIELDS.has(event.field_name)))

  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold">Історія змін</h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Подій немає.</p>
      ) : (
        <ul className="space-y-3 text-xs">
          {visible.map((event) => (
            <li key={event.id} className="border-l-2 border-border pl-3">
              <p className="font-medium">{describeEvent(event)}</p>
              <p className="text-muted-foreground">
                {(event.actor_id ? userMap.get(event.actor_id) : null) ?? '—'} ·{' '}
                {formatDate(event.created_at)}
              </p>
              {(event.old_value !== null || event.new_value !== null) && event.field_name && (
                <p className="mt-1 break-words text-muted-foreground">
                  {event.old_value !== null && event.old_value !== '' && (
                    <span>
                      Було:{' '}
                      <span className="text-foreground">
                        {formatValue(event.field_name, event.old_value, lookups)}
                      </span>
                    </span>
                  )}
                  {event.old_value !== null &&
                    event.old_value !== '' &&
                    event.new_value !== null &&
                    event.new_value !== '' &&
                    ' → '}
                  {event.new_value !== null && event.new_value !== '' && (
                    <span>
                      Стало:{' '}
                      <span className="text-foreground">
                        {formatValue(event.field_name, event.new_value, lookups)}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function describeEvent(event: ComplaintChangeLog) {
  switch (event.event_type) {
    case 'created':
      return 'Створено скаргу'
    case 'status_changed':
      return 'Змінено статус'
    case 'reopened':
      return 'Перевідкрито'
    case 'file_added':
      return `Додано файл: ${stringifyFileName(event.new_value)}`
    case 'file_deleted':
      return `Видалено файл: ${stringifyFileName(event.old_value)}`
    case 'field_updated':
      return `Змінено поле: ${fieldLabel(event.field_name)}`
    default:
      return event.event_type
  }
}

function fieldLabel(key: string | null) {
  return key ? FIELD_LABELS[key] ?? key : '—'
}

interface LookupMaps {
  userMap: Map<string, string>
  statusMap: Map<string, string>
  severityMap: Map<string, string>
  groupMap: Map<string, string>
  brandMap: Map<string, string>
  networkMap: Map<string, string>
}

function formatValue(fieldKey: string, value: unknown, lookups: LookupMaps) {
  if (value === null || value === undefined || value === '') return '—'
  if (fieldKey === 'source_type') {
    return value === 'client' ? 'Клієнт' : value === 'network' ? 'Торгова мережа' : String(value)
  }
  if (typeof value === 'string') {
    if (fieldKey === 'status_id') return lookups.statusMap.get(value) ?? value
    if (fieldKey === 'severity_id') return lookups.severityMap.get(value) ?? value
    if (fieldKey === 'complaint_group_id') return lookups.groupMap.get(value) ?? value
    if (fieldKey === 'manager_id' || fieldKey === 'created_by') return lookups.userMap.get(value) ?? value
    if (fieldKey === 'brand_id') return lookups.brandMap.get(value) ?? value
    if (fieldKey === 'retail_network_id') return lookups.networkMap.get(value) ?? value
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function stringifyFileName(value: unknown) {
  return value && typeof value === 'object' && 'file_name' in value
    ? String((value as { file_name: string }).file_name)
    : '—'
}
