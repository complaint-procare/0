import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Paperclip, Trash2 } from 'lucide-react'
import { Button, Card } from '@/components/ui/primitives'
import { SeverityBadge, StatusBadge } from '@/components/Badges'
import { formatDate, formatPhone, padComplaintNumber } from '@/lib/utils'
import type { Complaint, FieldDefinition } from '@/lib/types'
import type { ComplaintRegistryData, RegistryField } from './registry-types'

export function ComplaintRegistryList({
  complaints,
  fields,
  data,
  countByComplaint,
  isAdmin,
  onStatusChange,
  onDelete,
}: {
  complaints: Complaint[]
  fields: RegistryField[]
  data: ComplaintRegistryData
  countByComplaint: Map<string, number>
  isAdmin: boolean
  onStatusChange: (complaint: Complaint) => void
  onDelete: (complaint: Complaint) => void
}) {
  return (
    <>
      <div className="hidden md:block">
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {fields.map((field) => (
                    <th key={field.field_key} className="px-3 py-2">
                      {registryLabel(field)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center">Файли</th>
                  <th className="px-3 py-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr
                    key={complaint.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    {fields.map((field) => (
                      <td
                        key={field.field_key}
                        className={registryCellClass(field.field_key)}
                        title={registryTitle(field.field_key, complaint)}
                      >
                        {renderRegistryValue(field, complaint, data, countByComplaint)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <AttachmentCount complaintId={complaint.id} counts={countByComplaint} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RegistryActions
                        complaint={complaint}
                        isAdmin={isAdmin}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:hidden">
        {complaints.map((complaint) => (
          <Card key={complaint.id} className="space-y-2">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {fields.map((field) => (
                <div key={field.field_key} className="contents">
                  <div className="text-muted-foreground">{registryLabel(field)}</div>
                  <div className={registryMobileValueClass(field.field_key)}>
                    {renderRegistryValue(field, complaint, data, countByComplaint)}
                  </div>
                </div>
              ))}
              <div className="text-muted-foreground">Файли</div>
              <div><AttachmentCount complaintId={complaint.id} counts={countByComplaint} /></div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <Link to={`/complaints/${complaint.id}`} className="btn btn-outline btn-sm">
                Відкрити
              </Link>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onStatusChange(complaint)}>
                  Статус
                </Button>
                {isAdmin && (
                  <DeleteButton onClick={() => onDelete(complaint)} />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export function ComplaintRegistryPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>Показано {first}-{last} з {total}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Попередня сторінка"
          title="Попередня сторінка"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-24 text-center">Сторінка {page} з {pageCount}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          aria-label="Наступна сторінка"
          title="Наступна сторінка"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function RegistryActions({
  complaint,
  isAdmin,
  onStatusChange,
  onDelete,
}: {
  complaint: Complaint
  isAdmin: boolean
  onStatusChange: (complaint: Complaint) => void
  onDelete: (complaint: Complaint) => void
}) {
  return (
    <div className="flex justify-end gap-1">
      <Link to={`/complaints/${complaint.id}`} className="btn btn-outline btn-sm">Відкрити</Link>
      <Button size="sm" variant="ghost" onClick={() => onStatusChange(complaint)}>
        Змінити статус
      </Button>
      {isAdmin && <DeleteButton onClick={() => onDelete(complaint)} />}
    </div>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:bg-destructive/10"
      onClick={onClick}
      aria-label="Видалити скаргу"
      title="Видалити скаргу"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}

function registryLabel(field: RegistryField) {
  const labels: Record<string, string> = {
    number: '№',
    created_at: 'Дата',
    product_barcode: 'Штрихкод',
    batch_number: 'Партія',
    complaint_group_id: 'Група',
    problem_description: 'Опис',
    resolution_response: 'Рішення / Відповідь',
  }
  if (field.field_key === 'source_type' && field.label === 'Тип джерела') return 'Джерело'
  return labels[field.field_key] ?? field.label
}

function registryCellClass(fieldKey: string) {
  const base = 'px-3 py-2'
  if (['number', 'product_barcode', 'batch_number'].includes(fieldKey)) return `${base} font-mono text-xs`
  if (['created_at', 'source_type', 'client_phone', 'complaint_group_id'].includes(fieldKey)) {
    return `${base} whitespace-nowrap`
  }
  if (fieldKey === 'problem_description' || fieldKey === 'resolution_response') {
    return `${base} max-w-[280px] truncate`
  }
  if (fieldKey === 'product_name') return `${base} min-w-[180px]`
  return base
}

function registryMobileValueClass(fieldKey: string) {
  if (['number', 'product_barcode', 'batch_number', 'client_phone'].includes(fieldKey)) {
    return 'font-mono'
  }
  if (fieldKey === 'problem_description' || fieldKey === 'resolution_response') return 'line-clamp-2'
  return undefined
}

function registryTitle(fieldKey: string, complaint: Complaint) {
  if (fieldKey === 'problem_description') return complaint.problem_description
  if (fieldKey === 'resolution_response') return complaint.resolution_response
  if (fieldKey === 'product_name') return complaint.product_name
  return undefined
}

function renderRegistryValue(
  field: RegistryField,
  complaint: Complaint,
  data: ComplaintRegistryData,
  countByComplaint: Map<string, number>,
) {
  const byId = (
    collection: { id: string; name?: string; full_name?: string }[],
    id: string | null,
  ) => {
    const found = collection.find((item) => item.id === id)
    return id ? found?.name ?? found?.full_name ?? '—' : '—'
  }
  switch (field.field_key) {
    case 'number': return padComplaintNumber(complaint.number)
    case 'created_at': return formatDate(complaint.created_at)
    case 'created_by': return byId(data.users, complaint.created_by)
    case 'manager_id': return byId(data.users, complaint.manager_id)
    case 'source_type':
      return complaint.source_type === 'client'
        ? formatPhone(complaint.client_phone)
        : byId(data.networks, complaint.retail_network_id)
    case 'retail_network_id': return byId(data.networks, complaint.retail_network_id)
    case 'client_phone': return formatPhone(complaint.client_phone)
    case 'brand_id': return byId(data.brands, complaint.brand_id)
    case 'product_name': return complaint.product_name || '—'
    case 'product_barcode': return complaint.product_barcode || '—'
    case 'batch_number': return complaint.batch_number || '—'
    case 'complaint_group_id': return byId(data.groups, complaint.complaint_group_id)
    case 'problem_description': return complaint.problem_description || '—'
    case 'resolution_response': return complaint.resolution_response || '—'
    case 'severity_id': return <SeverityBadge id={complaint.severity_id} levels={data.severities} />
    case 'status_id': return <StatusBadge id={complaint.status_id} statuses={data.statuses} />
    case 'files':
    case 'attachments':
      return <AttachmentCount complaintId={complaint.id} counts={countByComplaint} />
    default:
      return formatRegistryValue(complaint.custom_fields?.[field.field_key], field.field_type)
  }
}

function AttachmentCount({
  complaintId,
  counts,
}: {
  complaintId: string
  counts: Map<string, number>
}) {
  const count = counts.get(complaintId)
  if (!count) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3" /> {count}
    </span>
  )
}

function formatRegistryValue(value: unknown, type: FieldDefinition['field_type']) {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'boolean') return value ? 'Так' : 'Ні'
  if (type === 'date' && typeof value === 'string') return formatDate(value)
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
