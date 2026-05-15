import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Columns3, Filter, Paperclip, Plus, Search, Trash2, X } from 'lucide-react'
import { list, remove, update } from '@/lib/db'
import { Button, Card, EmptyState, Input, Select, Toggle } from '@/components/ui/primitives'
import { formatDate, formatPhone, padComplaintNumber } from '@/lib/utils'
import type { Complaint, ComplaintAttachment, ComplaintStatus, FieldDefinition, SeverityLevel } from '@/lib/types'
import { StatusBadge, SeverityBadge } from '@/components/Badges'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { updateComplaint } from '@/lib/complaints'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'

interface Filters {
  statusId: string
  severityId: string
  brandId: string
  networkId: string
  sourceType: '' | 'network' | 'client'
  managerId: string
  from: string
  to: string
  search: string
}

const EMPTY: Filters = {
  statusId: '',
  severityId: '',
  brandId: '',
  networkId: '',
  sourceType: '',
  managerId: '',
  from: '',
  to: '',
  search: '',
}

const PAGE_SIZE = 50

type RegistryField = Pick<FieldDefinition, 'field_key' | 'label' | 'field_type' | 'sort_order'>
type LookupCollection = { id: string; name?: string; full_name?: string }[]
type LookupById = (collection: LookupCollection, id: string | null) => string

interface ComplaintsPageData {
  complaints: Complaint[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  brands: { id: string; name: string }[]
  networks: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
  attachments: ComplaintAttachment[]
  entities: { id: string; entity_key: string }[]
  fields: FieldDefinition[]
}

const DEFAULT_REGISTRY_FIELDS: RegistryField[] = [
  { field_key: 'number', label: '№', field_type: 'text', sort_order: 10 },
  { field_key: 'created_at', label: 'Дата', field_type: 'date', sort_order: 20 },
  { field_key: 'source_type', label: 'Джерело', field_type: 'select', sort_order: 45 },
  { field_key: 'brand_id', label: 'Бренд', field_type: 'reference', sort_order: 60 },
  { field_key: 'product_name', label: 'Продукт', field_type: 'text', sort_order: 70 },
  { field_key: 'product_barcode', label: 'Штрихкод', field_type: 'text', sort_order: 75 },
  { field_key: 'batch_number', label: 'Партія', field_type: 'text', sort_order: 80 },
  { field_key: 'manager_id', label: 'Менеджер', field_type: 'reference', sort_order: 90 },
  { field_key: 'problem_description', label: 'Опис', field_type: 'textarea', sort_order: 100 },
  { field_key: 'severity_id', label: 'Критичність', field_type: 'reference', sort_order: 110 },
  { field_key: 'status_id', label: 'Статус', field_type: 'reference', sort_order: 120 },
]

export function ComplaintsPage() {
  const { session, isAdmin } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [statusModal, setStatusModal] = useState<Complaint | null>(null)
  const [deleteModal, setDeleteModal] = useState<Complaint | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['complaints-page'],
    queryFn: async () => {
      const [complaints, statuses, severities, brands, networks, users, attachments, entities, fields] =
        await Promise.all([
          list('complaints'),
          list('complaint_statuses'),
          list('severity_levels'),
          list('brands'),
          list('retail_networks'),
          list('users'),
          list('complaint_attachments'),
          list('entity_definitions'),
          list('field_definitions'),
        ])
      return { complaints, statuses, severities, brands, networks, users, attachments, entities, fields }
    },
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const q = filters.search.trim().toLowerCase()
    return [...data.complaints]
      .filter((c) => {
        if (filters.statusId && c.status_id !== filters.statusId) return false
        if (filters.severityId && c.severity_id !== filters.severityId) return false
        if (filters.brandId && c.brand_id !== filters.brandId) return false
        if (filters.sourceType && c.source_type !== filters.sourceType) return false
        if (filters.networkId && c.retail_network_id !== filters.networkId) return false
        if (filters.managerId && c.manager_id !== filters.managerId) return false
        if (filters.from && c.created_at < filters.from) return false
        if (filters.to && c.created_at > `${filters.to}T23:59:59`) return false
        if (q) {
          const num = padComplaintNumber(c.number)
          const hay =
            `${num} ${c.batch_number} ${c.product_name ?? ''} ${c.product_barcode ?? ''} ${c.client_phone ?? ''} ${c.problem_description}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.number - a.number)
  }, [data, filters])

  const countByComplaint = useMemo(() => {
    const map = new Map<string, number>()
    if (!data) return map
    for (const a of data.attachments as ComplaintAttachment[]) {
      if (a.is_deleted) continue
      map.set(a.complaint_id, (map.get(a.complaint_id) ?? 0) + 1)
    }
    return map
  }, [data])

  const registryFields = useMemo<RegistryField[]>(() => {
    if (!data) return DEFAULT_REGISTRY_FIELDS
    const complaintEntity = data.entities.find((e) => e.entity_key === 'complaints')
    if (!complaintEntity) return DEFAULT_REGISTRY_FIELDS
    const fields = data.fields
      .filter(
        (f) =>
          f.entity_id === complaintEntity.id &&
          f.is_active &&
          f.is_visible &&
          f.show_in_registry &&
          !f.deleted_at,
      )
      .sort((a, b) => a.sort_order - b.sort_order)
    return fields.length ? fields : DEFAULT_REGISTRY_FIELDS
  }, [data])

  const byId = (collection: { id: string; name?: string; full_name?: string }[], id: string | null) => {
    if (!id) return '—'
    const found = collection.find((c) => c.id === id) as
      | { name?: string; full_name?: string }
      | undefined
    return found?.name ?? found?.full_name ?? '—'
  }

  const activeFilterCount = Object.values(filters).filter((v) => v && v.length).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleComplaints = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const deleteComplaint = async (complaint: Complaint) => {
    try {
      await remove('complaints', complaint.id)
      await refetch()
      toast.show('Скаргу видалено', 'success')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Oops!</h1>
          <p className="text-sm text-muted-foreground">
            Всього: {data?.complaints.length ?? 0}, показано: {filtered.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setColumnsOpen(true)}>
              <Columns3 className="h-4 w-4" /> Колонки
            </Button>
          )}
          <Button onClick={() => nav('/complaints/new')}>
            <Plus className="h-4 w-4" /> Нова скарга
          </Button>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Пошук: №, партія, текст…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <FilterRow filters={filters} setFilters={setFilters} data={data} />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
              <X className="h-3.5 w-3.5" /> Скинути
            </Button>
          )}
        </div>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Завантаження…</p>}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          title="Скарг немає"
          description="Створіть першу скаргу, щоб побачити її у реєстрі."
          action={
            <Button onClick={() => nav('/complaints/new')}>
              <Plus className="h-4 w-4" /> Нова скарга
            </Button>
          }
        />
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden md:block">
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {registryFields.map((field) => (
                      <th key={field.field_key} className={registryHeaderClass(field.field_key)}>
                        {registryLabel(field)}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center">Файли</th>
                    <th className="px-3 py-2 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleComplaints.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      {registryFields.map((field) => (
                        <td
                          key={field.field_key}
                          className={registryCellClass(field.field_key)}
                          title={registryTitle(field.field_key, c)}
                        >
                          {renderRegistryValue(field, c, data!, countByComplaint, byId)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        {renderAttachmentCount(c.id, countByComplaint)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/complaints/${c.id}`}
                            className="btn btn-outline btn-sm"
                          >
                            Відкрити
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatusModal(c)}
                          >
                            Змінити статус
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteModal(c)}
                              aria-label="Видалити скаргу"
                              title="Видалити скаргу"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {visibleComplaints.map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="grid grid-cols-2 gap-1 text-xs">
                {registryFields.map((field) => (
                  <div key={field.field_key} className="contents">
                    <div className="text-muted-foreground">{registryLabel(field)}</div>
                    <div className={registryMobileValueClass(field.field_key)}>
                      {renderRegistryValue(field, c, data!, countByComplaint, byId)}
                    </div>
                  </div>
                ))}
                <div className="text-muted-foreground">Файли</div>
                <div>{renderAttachmentCount(c.id, countByComplaint)}</div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Link to={`/complaints/${c.id}`} className="btn btn-outline btn-sm">
                  Відкрити
                </Link>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setStatusModal(c)}>
                    Статус
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteModal(c)}
                      aria-label="Видалити скаргу"
                      title="Видалити скаргу"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <PaginationControls
          page={page}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <StatusChangeDialog
        complaint={statusModal}
        statuses={data?.statuses ?? []}
        onClose={() => setStatusModal(null)}
        onSaved={async () => {
          await refetch()
          toast.show('Статус оновлено', 'success')
        }}
        actorId={session?.user_id ?? ''}
      />
      <ColumnsDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        fields={data?.fields ?? []}
        entities={data?.entities ?? []}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: ['complaints-page'] })
          await qc.invalidateQueries({ queryKey: ['field_definitions'] })
          await refetch()
          toast.show('Колонки оновлено', 'success')
        }}
      />
      <ConfirmDialog
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => {
          if (deleteModal) void deleteComplaint(deleteModal)
        }}
        title="Видалити скаргу?"
        description={
          deleteModal
            ? `Скарга #${padComplaintNumber(deleteModal.number)} буде видалена без можливості відновлення.`
            : undefined
        }
        confirmLabel="Видалити"
        destructive
      />
    </div>
  )
}

function registryLabel(field: RegistryField): string {
  if (field.field_key === 'number') return '№'
  if (field.field_key === 'created_at') return 'Дата'
  if (field.field_key === 'source_type') return field.label === 'Тип джерела' ? 'Джерело' : field.label
  if (field.field_key === 'product_barcode') return 'Штрихкод'
  if (field.field_key === 'batch_number') return 'Партія'
  if (field.field_key === 'problem_description') return 'Опис'
  return field.label
}

function registryHeaderClass(fieldKey: string): string {
  if (fieldKey === 'files') return 'px-3 py-2 text-center'
  return 'px-3 py-2'
}

function registryCellClass(fieldKey: string): string {
  const base = 'px-3 py-2'
  if (['number', 'product_barcode', 'batch_number'].includes(fieldKey)) return `${base} font-mono text-xs`
  if (['created_at', 'source_type', 'client_phone'].includes(fieldKey)) return `${base} whitespace-nowrap`
  if (fieldKey === 'problem_description') return `${base} max-w-[280px] truncate`
  if (fieldKey === 'product_name') return `${base} min-w-[180px]`
  return base
}

function registryMobileValueClass(fieldKey: string): string | undefined {
  if (['number', 'product_barcode', 'batch_number', 'client_phone'].includes(fieldKey)) return 'font-mono'
  if (fieldKey === 'problem_description') return 'line-clamp-2'
  return undefined
}

function registryTitle(fieldKey: string, complaint: Complaint): string | undefined {
  if (fieldKey === 'problem_description') return complaint.problem_description
  if (fieldKey === 'product_name') return complaint.product_name
  return undefined
}

function renderRegistryValue(
  field: RegistryField,
  complaint: Complaint,
  data: ComplaintsPageData,
  countByComplaint: Map<string, number>,
  byId: LookupById,
) {
  switch (field.field_key) {
    case 'number':
      return padComplaintNumber(complaint.number)
    case 'created_at':
      return formatDate(complaint.created_at)
    case 'created_by':
      return byId(data.users, complaint.created_by)
    case 'manager_id':
      return byId(data.users, complaint.manager_id)
    case 'source_type':
      return complaint.source_type === 'client'
        ? formatPhone(complaint.client_phone)
        : byId(data.networks, complaint.retail_network_id)
    case 'retail_network_id':
      return byId(data.networks, complaint.retail_network_id)
    case 'client_phone':
      return formatPhone(complaint.client_phone)
    case 'brand_id':
      return byId(data.brands, complaint.brand_id)
    case 'product_name':
      return complaint.product_name || '—'
    case 'product_barcode':
      return complaint.product_barcode || '—'
    case 'batch_number':
      return complaint.batch_number || '—'
    case 'problem_description':
      return complaint.problem_description || '—'
    case 'severity_id':
      return <SeverityBadge id={complaint.severity_id} levels={data.severities} />
    case 'status_id':
      return <StatusBadge id={complaint.status_id} statuses={data.statuses} />
    case 'files':
    case 'attachments':
      return renderAttachmentCount(complaint.id, countByComplaint)
    default:
      return formatRegistryValue(complaint.custom_fields?.[field.field_key], field.field_type)
  }
}

function renderAttachmentCount(complaintId: string, countByComplaint: Map<string, number>) {
  const count = countByComplaint.get(complaintId)
  if (!count) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3" />
      {count}
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

function PaginationControls({
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
      <span>
        Показано {first}-{last} з {total}
      </span>
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
        <span className="min-w-24 text-center">
          Сторінка {page} з {pageCount}
        </span>
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

function FilterRow({
  filters,
  setFilters,
  data,
}: {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  data:
    | {
        statuses: { id: string; name: string }[]
        severities: { id: string; name: string }[]
        brands: { id: string; name: string }[]
        networks: { id: string; name: string }[]
        users: { id: string; full_name: string }[]
      }
    | undefined
}) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Filter className="h-3.5 w-3.5" /> Фільтри
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Фільтри" size="lg">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            value={filters.statusId}
            onChange={(e) => setFilters((f) => ({ ...f, statusId: e.target.value }))}
          >
            <option value="">Усі статуси</option>
            {data.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.severityId}
            onChange={(e) => setFilters((f) => ({ ...f, severityId: e.target.value }))}
          >
            <option value="">Усі рівні критичності</option>
            {data.severities.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.brandId}
            onChange={(e) => setFilters((f) => ({ ...f, brandId: e.target.value }))}
          >
            <option value="">Усі бренди</option>
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.sourceType}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sourceType: e.target.value as Filters['sourceType'],
                networkId: e.target.value === 'client' ? '' : f.networkId,
              }))
            }
          >
            <option value="">Усі джерела</option>
            <option value="network">Тільки мережі</option>
            <option value="client">Тільки клієнти</option>
          </Select>
          <Select
            value={filters.networkId}
            onChange={(e) => setFilters((f) => ({ ...f, networkId: e.target.value }))}
            disabled={filters.sourceType === 'client'}
          >
            <option value="">Усі мережі</option>
            {data.networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.managerId}
            onChange={(e) => setFilters((f) => ({ ...f, managerId: e.target.value }))}
          >
            <option value="">Усі менеджери</option>
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </Select>
          <div className="min-w-0 space-y-1.5 overflow-hidden">
            <label className="block text-xs font-medium text-muted-foreground">Дата від</label>
            <Input
              type="date"
              className="w-full min-w-0 max-w-full"
              aria-label="Дата від"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="min-w-0 space-y-1.5 overflow-hidden">
            <label className="block text-xs font-medium text-muted-foreground">Дата до</label>
            <Input
              type="date"
              className="w-full min-w-0 max-w-full"
              aria-label="Дата до"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Готово
          </Button>
        </div>
      </Dialog>
    </>
  )
}

function StatusChangeDialog({
  complaint,
  statuses,
  onClose,
  onSaved,
  actorId,
}: {
  complaint: Complaint | null
  statuses: { id: string; name: string; is_closed: boolean }[]
  onClose: () => void
  onSaved: () => void | Promise<void>
  actorId: string
}) {
  const toast = useToast()
  const [statusId, setStatusId] = useState('')
  const currentStatus = statuses.find((s) => s.id === complaint?.status_id)
  const closed = currentStatus?.is_closed
  return (
    <Dialog
      open={!!complaint}
      onClose={onClose}
      title={complaint ? `Скарга #${padComplaintNumber(complaint.number)}` : ''}
      description={closed ? 'Скарга закрита. Можна перевідкрити.' : 'Оберіть новий статус.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          {closed ? (
            <Button
              onClick={async () => {
                if (!complaint) return
                try {
                  await updateComplaint({
                    id: complaint.id,
                    actor_id: actorId,
                    patch: {},
                    reopen: true,
                  })
                  await onSaved()
                  onClose()
                } catch (e) {
                  toast.show((e as Error).message, 'error')
                }
              }}
            >
              Перевідкрити
            </Button>
          ) : (
            <Button
              disabled={!statusId || statusId === complaint?.status_id}
              onClick={async () => {
                if (!complaint || !statusId) return
                try {
                  await updateComplaint({
                    id: complaint.id,
                    actor_id: actorId,
                    patch: { status_id: statusId },
                  })
                  await onSaved()
                  onClose()
                } catch (e) {
                  toast.show((e as Error).message, 'error')
                }
              }}
            >
              Зберегти
            </Button>
          )}
        </>
      }
    >
      {!closed && (
        <Select value={statusId} onChange={(e) => setStatusId(e.target.value)} autoFocus>
          <option value="">Оберіть статус…</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id} disabled={s.id === complaint?.status_id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
    </Dialog>
  )
}


function ColumnsDialog({
  open,
  onClose,
  fields,
  entities,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  fields: FieldDefinition[]
  entities: { id: string; entity_key: string }[]
  onSaved: () => void | Promise<void>
}) {
  const toast = useToast()
  const complaintEntity = entities.find((e) => e.entity_key === 'complaints')
  const initial = useMemo<RegistryColumn[]>(() => {
    if (!complaintEntity) return []
    return fields
      .filter((f) => f.entity_id === complaintEntity.id && f.is_active && !f.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({
        id: f.id,
        label: f.label,
        field_key: f.field_key,
        show_in_registry: f.show_in_registry,
      }))
  }, [complaintEntity, fields])

  const [items, setItems] = useState<RegistryColumn[]>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setItems(initial)
  }, [open, initial])

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const toggleVisible = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, show_in_registry: !it.show_in_registry } : it)),
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      // Compare against initial to update only changed rows.
      const initialMap = new Map(initial.map((it) => [it.id, it]))
      await Promise.all(
        items.map((it, idx) => {
          const before = initialMap.get(it.id)
          const newOrder = (idx + 1) * 10
          const orderChanged = !before || before_orderOf(before, initial) !== newOrder
          const visChanged = !before || before.show_in_registry !== it.show_in_registry
          if (!orderChanged && !visChanged) return null
          return update('field_definitions', it.id, {
            sort_order: newOrder,
            show_in_registry: it.show_in_registry,
            updated_at: now,
          })
        }),
      )
      await onSaved()
      onClose()
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Колонки реєстру"
      description="Стрілки змінюють порядок зліва направо. Перемикач — показати у таблиці."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Скасувати
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {items.map((it, idx) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 text-right text-xs text-muted-foreground">{idx + 1}.</span>
              <Toggle
                checked={it.show_in_registry}
                onChange={() => toggleVisible(idx)}
                aria-label="Показувати в реєстрі"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{it.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{it.field_key}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                aria-label="Лівіше"
                title="Лівіше"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={idx === items.length - 1}
                onClick={() => move(idx, 1)}
                aria-label="Правіше"
                title="Правіше"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Полів немає.</p>
        )}
      </ul>
    </Dialog>
  )
}

interface RegistryColumn {
  id: string
  label: string
  field_key: string
  show_in_registry: boolean
}

function before_orderOf(it: RegistryColumn, initial: RegistryColumn[]): number {
  const idx = initial.findIndex((x) => x.id === it.id)
  return idx === -1 ? -1 : (idx + 1) * 10
}
