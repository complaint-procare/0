import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BarChart3, Filter, X } from 'lucide-react'
import { list } from '@/lib/db'
import { Card, Button } from '@/components/ui/primitives'
import { MultiSelect } from '@/components/ui/multi-select'
import { cn } from '@/lib/utils'
import type {
  Brand,
  Complaint,
  ComplaintStatus,
  Product,
  RetailNetwork,
  SeverityLevel,
  User,
} from '@/lib/types'

type Period = 'day' | 'week' | 'month'

interface AnalyticsFilters {
  brandIds: string[]
  productNames: string[]
  statusIds: string[]
  severityIds: string[]
  networkIds: string[]
  managerIds: string[]
}

const EMPTY_FILTERS: AnalyticsFilters = {
  brandIds: [],
  productNames: [],
  statusIds: [],
  severityIds: [],
  networkIds: [],
  managerIds: [],
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('day')
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-data'],
    queryFn: async () => {
      const [complaints, statuses, severities, brands, products, networks, users] =
        await Promise.all([
          list('complaints'),
          list('complaint_statuses'),
          list('severity_levels'),
          list('brands'),
          list('products'),
          list('retail_networks'),
          list('users'),
        ])
      return {
        complaints: complaints as Complaint[],
        statuses: statuses as ComplaintStatus[],
        severities: severities as SeverityLevel[],
        brands: brands as Brand[],
        products: products as Product[],
        networks: networks as RetailNetwork[],
        users: users as User[],
      }
    },
  })

  const filtered = useMemo(() => {
    if (!data) return [] as Complaint[]
    return data.complaints.filter((c) => {
      if (filters.brandIds.length && !filters.brandIds.includes(c.brand_id ?? '')) return false
      if (filters.productNames.length && !filters.productNames.includes(c.product_name)) return false
      if (filters.statusIds.length && !filters.statusIds.includes(c.status_id ?? '')) return false
      if (filters.severityIds.length && !filters.severityIds.includes(c.severity_id ?? '')) return false
      if (
        filters.networkIds.length &&
        !filters.networkIds.includes(c.retail_network_id ?? '')
      )
        return false
      if (filters.managerIds.length && !filters.managerIds.includes(c.manager_id)) return false
      return true
    })
  }, [data, filters])

  const stats = useMemo(() => computeStats(filtered, data?.statuses ?? []), [filtered, data])
  const buckets = useMemo(() => computeBuckets(filtered, period), [filtered, period])

  const filterCount = Object.values(filters).reduce((s, a) => s + a.length, 0)

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      </div>
    )
  }

  const productOptions = uniqueNames(data.complaints, data.products)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Аналітика</h1>
          <p className="text-sm text-muted-foreground">
            Усього скарг у вибірці: {filtered.length} з {data.complaints.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodToggle value={period} onChange={setPeriod} />
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="h-3.5 w-3.5" /> Скинути {filterCount}
            </Button>
          )}
        </div>
      </div>

      <FiltersCard filters={filters} setFilters={setFilters} data={data} productOptions={productOptions} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всього" value={stats.total} delta={stats.deltaTotal} />
        <StatCard label="Нові" value={stats.open} delta={stats.deltaOpen} tone="good" />
        <StatCard label="В роботі" value={stats.inProgress} delta={stats.deltaInProgress} tone="warn" />
        <StatCard label="Закриті" value={stats.closed} delta={stats.deltaClosed} tone="bad" />
      </div>

      <Card padding={false} className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Динаміка</p>
            <p className="text-2xl font-bold tracking-tight">{filtered.length} скарг</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> {periodLabel(period)}
          </div>
        </div>
        <BarChart buckets={buckets} />
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="За статусом"
          rows={breakdownByStatus(filtered, data.statuses)}
        />
        <BreakdownCard
          title="За брендом"
          rows={breakdownByBrand(filtered, data.brands)}
        />
      </div>
    </div>
  )
}

function FiltersCard({
  filters,
  setFilters,
  data,
  productOptions,
}: {
  filters: AnalyticsFilters
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilters>>
  data: {
    statuses: ComplaintStatus[]
    severities: SeverityLevel[]
    brands: Brand[]
    networks: RetailNetwork[]
    users: User[]
  }
  productOptions: { value: string; label: string }[]
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4 text-muted-foreground" />
        Фільтри
        <span className="text-xs font-normal text-muted-foreground">(множинний вибір)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <FilterField label="Бренди">
          <MultiSelect
            placeholder="Усі бренди"
            options={data.brands.map((b) => ({ value: b.id, label: b.name }))}
            selected={filters.brandIds}
            onChange={(v) => setFilters((f) => ({ ...f, brandIds: v }))}
          />
        </FilterField>
        <FilterField label="Товари">
          <MultiSelect
            placeholder="Усі товари"
            options={productOptions}
            selected={filters.productNames}
            onChange={(v) => setFilters((f) => ({ ...f, productNames: v }))}
          />
        </FilterField>
        <FilterField label="Статуси">
          <MultiSelect
            placeholder="Усі статуси"
            options={data.statuses.map((s) => ({ value: s.id, label: s.name }))}
            selected={filters.statusIds}
            onChange={(v) => setFilters((f) => ({ ...f, statusIds: v }))}
          />
        </FilterField>
        <FilterField label="Критичність">
          <MultiSelect
            placeholder="Усі рівні"
            options={data.severities.map((s) => ({ value: s.id, label: s.name }))}
            selected={filters.severityIds}
            onChange={(v) => setFilters((f) => ({ ...f, severityIds: v }))}
          />
        </FilterField>
        <FilterField label="Торгові мережі">
          <MultiSelect
            placeholder="Усі мережі"
            options={data.networks.map((n) => ({ value: n.id, label: n.name }))}
            selected={filters.networkIds}
            onChange={(v) => setFilters((f) => ({ ...f, networkIds: v }))}
          />
        </FilterField>
        <FilterField label="Менеджери">
          <MultiSelect
            placeholder="Усі менеджери"
            options={data.users.map((u) => ({ value: u.id, label: u.full_name }))}
            selected={filters.managerIds}
            onChange={(v) => setFilters((f) => ({ ...f, managerIds: v }))}
          />
        </FilterField>
      </div>
    </Card>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { value: Period; label: string }[] = [
    { value: 'day', label: 'День' },
    { value: 'week', label: 'Тиждень' },
    { value: 'month', label: 'Місяць' },
  ]
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs transition-colors',
            value === o.value
              ? 'bg-foreground text-background font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string
  value: number
  delta: number
  tone?: 'good' | 'warn' | 'bad'
}) {
  const positive = delta >= 0
  const deltaTone =
    delta === 0
      ? 'pill-neutral'
      : positive
        ? tone === 'bad'
          ? 'pill-bad'
          : 'pill-good'
        : tone === 'good'
          ? 'pill-bad'
          : 'pill-warn'
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <span className={cn('badge', deltaTone, 'gap-0.5')}>
          {delta === 0 ? null : positive ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
    </Card>
  )
}

function BarChart({ buckets }: { buckets: { label: string; value: number; isPeak?: boolean }[] }) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Немає даних для побудови графіка
      </div>
    )
  }
  const max = Math.max(...buckets.map((b) => b.value), 1)
  return (
    <div className="space-y-2">
      <div className="flex h-48 items-end gap-1">
        {buckets.map((b, i) => {
          const h = (b.value / max) * 100
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  b.isPeak ? 'bg-foreground' : 'bg-muted',
                  'group-hover:bg-foreground/70',
                )}
                style={{ height: `${Math.max(h, 2)}%` }}
                title={`${b.label}: ${b.value}`}
              />
              {b.value > 0 && b.isPeak && (
                <div className="absolute -top-5 text-[10px] font-semibold text-foreground">
                  {b.value}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-muted-foreground">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            {i % Math.max(1, Math.floor(buckets.length / 6)) === 0 ? b.label : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: number; tone?: string }[]
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  return (
    <Card>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Немає даних</p>}
      <div className="space-y-2">
        {rows.map((r) => {
          const pct = (r.value / total) * 100
          return (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate">{r.label}</span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {r.value} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', r.tone ?? 'bg-foreground')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function uniqueNames(complaints: Complaint[], products: Product[]): { value: string; label: string }[] {
  const set = new Set<string>()
  for (const c of complaints) {
    if (c.product_name) set.add(c.product_name)
  }
  for (const p of products) {
    if (p.name) set.add(p.name)
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, 'uk'))
    .map((n) => ({ value: n, label: n }))
}

function computeStats(complaints: Complaint[], statuses: ComplaintStatus[]) {
  const closedIds = new Set(statuses.filter((s) => s.is_closed).map((s) => s.id))
  const openName = statuses.find((s) => s.name === 'Нова')?.id
  const inProgressName = statuses.find((s) => s.name === 'В роботі')?.id

  const total = complaints.length
  const open = complaints.filter((c) => c.status_id === openName).length
  const inProgress = complaints.filter((c) => c.status_id === inProgressName).length
  const closed = complaints.filter((c) => closedIds.has(c.status_id ?? '')).length

  const now = Date.now()
  const week = 7 * 24 * 60 * 60 * 1000
  const last7 = complaints.filter((c) => now - new Date(c.created_at).getTime() < week)
  const prev7 = complaints.filter(
    (c) =>
      now - new Date(c.created_at).getTime() >= week &&
      now - new Date(c.created_at).getTime() < 2 * week,
  )
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100)

  return {
    total,
    open,
    inProgress,
    closed,
    deltaTotal: delta(last7.length, prev7.length),
    deltaOpen: delta(
      last7.filter((c) => c.status_id === openName).length,
      prev7.filter((c) => c.status_id === openName).length,
    ),
    deltaInProgress: delta(
      last7.filter((c) => c.status_id === inProgressName).length,
      prev7.filter((c) => c.status_id === inProgressName).length,
    ),
    deltaClosed: delta(
      last7.filter((c) => closedIds.has(c.status_id ?? '')).length,
      prev7.filter((c) => closedIds.has(c.status_id ?? '')).length,
    ),
  }
}

function computeBuckets(complaints: Complaint[], period: Period) {
  const now = new Date()
  const buckets: { label: string; value: number; isPeak?: boolean; key: string }[] = []
  if (period === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      buckets.push({
        label: `${d.getDate()}.${d.getMonth() + 1}`,
        value: 0,
        key,
      })
    }
    for (const c of complaints) {
      const k = c.created_at.slice(0, 10)
      const b = buckets.find((b) => b.key === k)
      if (b) b.value++
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const key = isoWeekKey(d)
      buckets.push({ label: `W${key.slice(-2)}`, value: 0, key })
    }
    for (const c of complaints) {
      const k = isoWeekKey(new Date(c.created_at))
      const b = buckets.find((b) => b.key === k)
      if (b) b.value++
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      buckets.push({ label: monthShort(d.getMonth()), value: 0, key })
    }
    for (const c of complaints) {
      const d = new Date(c.created_at)
      const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
      const b = buckets.find((b) => b.key === k)
      if (b) b.value++
    }
  }
  const max = Math.max(...buckets.map((b) => b.value))
  for (const b of buckets) b.isPeak = b.value === max && max > 0
  return buckets
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-${week.toString().padStart(2, '0')}`
}

function monthShort(m: number): string {
  return ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'][m]
}

function periodLabel(p: Period): string {
  return p === 'day' ? 'За 14 днів' : p === 'week' ? 'За 8 тижнів' : 'За 12 місяців'
}

function breakdownByStatus(complaints: Complaint[], statuses: ComplaintStatus[]) {
  const tones: Record<string, string> = {
    'Нова': 'bg-emerald-400',
    'В роботі': 'bg-amber-400',
    'Очікує відповідь клієнта': 'bg-amber-300',
    'Очікує ВКЯ': 'bg-amber-500',
    'Закрита': 'bg-slate-400',
    'Відхилена': 'bg-rose-400',
  }
  return statuses
    .map((s) => ({
      label: s.name,
      value: complaints.filter((c) => c.status_id === s.id).length,
      tone: tones[s.name] ?? 'bg-foreground',
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
}

function breakdownByBrand(complaints: Complaint[], brands: Brand[]) {
  return brands
    .map((b) => ({
      label: b.name,
      value: complaints.filter((c) => c.brand_id === b.id).length,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}
