import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Filter, Paperclip, Plus, Search, X } from 'lucide-react'
import { list } from '@/lib/db'
import { Button, Card, EmptyState, Input, Select } from '@/components/ui/primitives'
import { formatDate, formatPhone, padComplaintNumber } from '@/lib/utils'
import type { Complaint, ComplaintAttachment } from '@/lib/types'
import { StatusBadge, SeverityBadge } from '@/components/Badges'
import { Dialog } from '@/components/ui/dialog'
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

export function ComplaintsPage() {
  const { session } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [statusModal, setStatusModal] = useState<Complaint | null>(null)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['complaints-page'],
    queryFn: async () => {
      const [complaints, statuses, severities, brands, networks, users, attachments] =
        await Promise.all([
          list('complaints'),
          list('complaint_statuses'),
          list('severity_levels'),
          list('brands'),
          list('retail_networks'),
          list('users'),
          list('complaint_attachments'),
        ])
      return { complaints, statuses, severities, brands, networks, users, attachments }
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

  const byId = (collection: { id: string; name?: string; full_name?: string }[], id: string | null) => {
    if (!id) return '—'
    const found = collection.find((c) => c.id === id) as
      | { name?: string; full_name?: string }
      | undefined
    return found?.name ?? found?.full_name ?? '—'
  }

  const activeFilterCount = Object.values(filters).filter((v) => v && v.length).length

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Oops!</h1>
          <p className="text-sm text-muted-foreground">
            Всього: {data?.complaints.length ?? 0}, показано: {filtered.length}
          </p>
        </div>
        <Button onClick={() => nav('/complaints/new')}>
          <Plus className="h-4 w-4" /> Нова скарга
        </Button>
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
                    <th className="px-3 py-2">№</th>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Джерело</th>
                    <th className="px-3 py-2">Бренд</th>
                    <th className="px-3 py-2">Продукт</th>
                    <th className="px-3 py-2">Штрихкод</th>
                    <th className="px-3 py-2">Партія</th>
                    <th className="px-3 py-2">Менеджер</th>
                    <th className="px-3 py-2">Опис</th>
                    <th className="px-3 py-2">Критичність</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2 text-center">Файли</th>
                    <th className="px-3 py-2 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2 font-mono">{padComplaintNumber(c.number)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {c.source_type === 'client' ? (
                          <span className="font-mono text-xs">{formatPhone(c.client_phone)}</span>
                        ) : (
                          byId(data!.networks, c.retail_network_id)
                        )}
                      </td>
                      <td className="px-3 py-2">{byId(data!.brands, c.brand_id)}</td>
                      <td className="px-3 py-2">{c.product_name || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.product_barcode || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.batch_number}</td>
                      <td className="px-3 py-2">{byId(data!.users, c.manager_id)}</td>
                      <td className="px-3 py-2 max-w-[280px] truncate" title={c.problem_description}>
                        {c.problem_description}
                      </td>
                      <td className="px-3 py-2">
                        <SeverityBadge id={c.severity_id} levels={data!.severities} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge id={c.status_id} statuses={data!.statuses} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {countByComplaint.get(c.id) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {countByComplaint.get(c.id)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
          {filtered.map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">#{padComplaintNumber(c.number)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                </div>
                <SeverityBadge id={c.severity_id} levels={data!.severities} />
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="text-muted-foreground">
                  {c.source_type === 'client' ? 'Клієнт' : 'Мережа'}
                </div>
                <div className={c.source_type === 'client' ? 'font-mono' : undefined}>
                  {c.source_type === 'client'
                    ? formatPhone(c.client_phone)
                    : byId(data!.networks, c.retail_network_id)}
                </div>
                <div className="text-muted-foreground">Бренд</div>
                <div>{byId(data!.brands, c.brand_id)}</div>
                <div className="text-muted-foreground">Продукт</div>
                <div>{c.product_name || '—'}</div>
                {c.product_barcode && (
                  <>
                    <div className="text-muted-foreground">Штрихкод</div>
                    <div className="font-mono">{c.product_barcode}</div>
                  </>
                )}
                <div className="text-muted-foreground">Партія</div>
                <div className="font-mono">{c.batch_number}</div>
              </div>
              <p className="line-clamp-2 text-sm">{c.problem_description}</p>
              <div className="flex items-center justify-between gap-2 pt-2">
                <StatusBadge id={c.status_id} statuses={data!.statuses} />
                <div className="flex gap-1">
                  <Link to={`/complaints/${c.id}`} className="btn btn-outline btn-sm">
                    Відкрити
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setStatusModal(c)}>
                    Статус
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
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
