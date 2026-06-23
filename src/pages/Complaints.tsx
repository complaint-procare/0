import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Columns3, Plus, Search, X } from 'lucide-react'
import { list, remove } from '@/lib/db'
import { Button, Card, EmptyState, Input } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/dialog'
import {
  ComplaintRegistryList,
  ComplaintRegistryPagination,
} from '@/components/complaints/ComplaintRegistryList'
import { ComplaintRegistryFilterDialog } from '@/components/complaints/ComplaintRegistryFilters'
import {
  ComplaintColumnsDialog,
  ComplaintStatusDialog,
} from '@/components/complaints/ComplaintRegistryDialogs'
import {
  DEFAULT_REGISTRY_FIELDS,
  EMPTY_REGISTRY_FILTERS,
  type ComplaintRegistryData,
  type ComplaintRegistryFilters,
  type RegistryField,
} from '@/components/complaints/registry-types'
import { getComplaintViewCounts } from '@/lib/complaints'
import { padComplaintNumber } from '@/lib/utils'
import type { Complaint, ComplaintAttachment } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { QueryErrorState } from '@/components/ui/query-state'

const PAGE_SIZE = 50

export function ComplaintsPage() {
  const { session, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ComplaintRegistryFilters>(EMPTY_REGISTRY_FILTERS)
  const [statusModal, setStatusModal] = useState<Complaint | null>(null)
  const [deleteModal, setDeleteModal] = useState<Complaint | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [page, setPage] = useState(1)

  const {
    data,
    error,
    refetch,
    isLoading,
    isError,
    isFetching,
    isRefetchError,
  } = useQuery({
    queryKey: ['complaints-page'],
    queryFn: loadComplaintRegistryData,
  })

  const filtered = useMemo(
    () => filterRegistryComplaints(data, filters),
    [data, filters],
  )
  const countByComplaint = useMemo(
    () => countAttachments(data?.attachments ?? []),
    [data],
  )
  const viewsByComplaint = useMemo(
    () => countUniqueViews(data?.viewCounts ?? []),
    [data],
  )
  const registryFields = useMemo(
    () => resolveRegistryFields(data),
    [data],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleComplaints = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])
  const activeFilterCount = Object.values(filters).filter(Boolean).length

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
    } catch (error) {
      toast.show((error as Error).message, 'error')
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
          <Button onClick={() => navigate('/complaints/new')}>
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
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>
          <ComplaintRegistryFilterDialog
            filters={filters}
            setFilters={setFilters}
            data={data}
          />
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_REGISTRY_FILTERS)}
            >
              <X className="h-3.5 w-3.5" /> Скинути
            </Button>
          )}
        </div>
      </Card>

      {isRefetchError && data && (
        <QueryErrorState
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
          title="Не вдалося оновити реєстр"
          description="Показано останні успішно завантажені дані."
          compact
        />
      )}

      {isError && !data ? (
        <QueryErrorState
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
          title="Не вдалося завантажити реєстр"
        />
      ) : (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Завантаження…</p>}

          {!isLoading && filtered.length === 0 && (
            <EmptyState
              title="Скарг немає"
              description="Створіть першу скаргу, щоб побачити її у реєстрі."
              action={
                <Button onClick={() => navigate('/complaints/new')}>
                  <Plus className="h-4 w-4" /> Нова скарга
                </Button>
              }
            />
          )}

          {data && filtered.length > 0 && (
            <ComplaintRegistryList
              complaints={visibleComplaints}
              fields={registryFields}
              data={data}
              countByComplaint={countByComplaint}
              viewsByComplaint={viewsByComplaint}
              isAdmin={isAdmin}
              onStatusChange={setStatusModal}
              onDelete={setDeleteModal}
            />
          )}

          {filtered.length > PAGE_SIZE && (
            <ComplaintRegistryPagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ComplaintStatusDialog
        complaint={statusModal}
        statuses={data?.statuses ?? []}
        onClose={() => setStatusModal(null)}
        onSaved={async () => {
          await refetch()
          toast.show('Статус оновлено', 'success')
        }}
        actorId={session?.user_id ?? ''}
      />
      <ComplaintColumnsDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        fields={data?.fields ?? []}
        entities={data?.entities ?? []}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['complaints-page'] })
          await queryClient.invalidateQueries({ queryKey: ['field_definitions'] })
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

async function loadComplaintRegistryData(): Promise<ComplaintRegistryData> {
  const [
    complaints,
    statuses,
    severities,
    groups,
    brands,
    networks,
    users,
    attachments,
    viewCounts,
    entities,
    fields,
  ] = await Promise.all([
    list('complaints'),
    list('complaint_statuses'),
    list('severity_levels'),
    list('complaint_groups'),
    list('brands'),
    list('retail_networks'),
    list('users'),
    list('complaint_attachments'),
    getComplaintViewCounts(),
    list('entity_definitions'),
    list('field_definitions'),
  ])
  return {
    complaints,
    statuses,
    severities,
    groups,
    brands,
    networks,
    users,
    attachments,
    viewCounts,
    entities,
    fields,
  }
}

function filterRegistryComplaints(
  data: ComplaintRegistryData | undefined,
  filters: ComplaintRegistryFilters,
) {
  if (!data) return []
  const search = filters.search.trim().toLowerCase()
  return [...data.complaints]
    .filter((complaint) => {
      if (filters.statusId && complaint.status_id !== filters.statusId) return false
      if (filters.severityId && complaint.severity_id !== filters.severityId) return false
      if (filters.groupId && complaint.complaint_group_id !== filters.groupId) return false
      if (filters.brandId && complaint.brand_id !== filters.brandId) return false
      if (filters.sourceType && complaint.source_type !== filters.sourceType) return false
      if (filters.networkId && complaint.retail_network_id !== filters.networkId) return false
      if (filters.managerId && complaint.manager_id !== filters.managerId) return false
      if (filters.from && complaint.created_at < filters.from) return false
      if (filters.to && complaint.created_at > `${filters.to}T23:59:59`) return false
      if (search) {
        const groupName =
          data.groups.find((group) => group.id === complaint.complaint_group_id)?.name ?? ''
        const haystack =
          `${padComplaintNumber(complaint.number)} ${complaint.batch_number} ${groupName} ` +
          `${complaint.product_name ?? ''} ${complaint.product_barcode ?? ''} ` +
          `${complaint.client_phone ?? ''} ${complaint.problem_description} ` +
          `${complaint.resolution_response ?? ''}`
        if (!haystack.toLowerCase().includes(search)) return false
      }
      return true
    })
    .sort((a, b) => b.number - a.number)
}

function countUniqueViews(viewCounts: { complaint_id: string; unique_views: number }[]) {
  return new Map(viewCounts.map((row) => [row.complaint_id, row.unique_views]))
}

function countAttachments(attachments: ComplaintAttachment[]) {
  const counts = new Map<string, number>()
  for (const attachment of attachments) {
    if (attachment.is_deleted) continue
    counts.set(attachment.complaint_id, (counts.get(attachment.complaint_id) ?? 0) + 1)
  }
  return counts
}

function resolveRegistryFields(data: ComplaintRegistryData | undefined): RegistryField[] {
  if (!data) return DEFAULT_REGISTRY_FIELDS
  const complaintEntity = data.entities.find((entity) => entity.entity_key === 'complaints')
  if (!complaintEntity) return DEFAULT_REGISTRY_FIELDS
  const fields = data.fields
    .filter(
      (field) =>
        field.entity_id === complaintEntity.id &&
        field.is_active &&
        field.is_visible &&
        field.show_in_registry &&
        !field.deleted_at,
    )
    .sort((a, b) => a.sort_order - b.sort_order)
  return fields.length ? fields : DEFAULT_REGISTRY_FIELDS
}
