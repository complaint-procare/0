import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, X } from 'lucide-react'
import { list } from '@/lib/db'
import { Button, Card } from '@/components/ui/primitives'
import {
  AnalyticsFiltersCard,
  AnalyticsPeriodToggle,
} from '@/components/analytics/AnalyticsControls'
import {
  AnalyticsSmoothBrandChart,
  AnalyticsBreakdownCard,
  AnalyticsStatCard,
} from '@/components/analytics/AnalyticsCharts'
import {
  analyticsPeriodLabel,
  breakdownByBrand,
  breakdownByStatus,
  computeAnalyticsBuckets,
  computeBrandDynamics,
  computeAnalyticsStats,
  filterComplaints,
  uniqueProductNames,
} from '@/components/analytics/analytics-calculations'
import {
  EMPTY_ANALYTICS_FILTERS,
  type AnalyticsData,
  type AnalyticsFilters,
  type AnalyticsPeriod,
} from '@/components/analytics/analytics-types'
import { QueryErrorState } from '@/components/ui/query-state'

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('day')
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS)
  const {
    data,
    error,
    refetch,
    isLoading,
    isError,
    isFetching,
    isRefetchError,
  } = useQuery({
    queryKey: ['analytics-data'],
    queryFn: loadAnalyticsData,
  })

  const filtered = useMemo(
    () => filterComplaints(data?.complaints ?? [], filters),
    [data, filters],
  )
  const stats = useMemo(
    () => computeAnalyticsStats(filtered, data?.statuses ?? []),
    [filtered, data],
  )
  const buckets = useMemo(
    () => computeAnalyticsBuckets(filtered, period),
    [filtered, period],
  )
  const brandSeries = useMemo(
    () => computeBrandDynamics(buckets, data?.brands ?? []),
    [buckets, data?.brands],
  )

  if (isError && !data) {
    return (
      <div className="p-4 md:p-6">
        <QueryErrorState
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
          title="Не вдалося завантажити аналітику"
        />
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      </div>
    )
  }

  const filterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0)
  const productOptions = uniqueProductNames(data.complaints, data.products)

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
          <AnalyticsPeriodToggle value={period} onChange={setPeriod} />
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_ANALYTICS_FILTERS)}>
              <X className="h-3.5 w-3.5" /> Скинути {filterCount}
            </Button>
          )}
        </div>
      </div>

      <AnalyticsFiltersCard
        filters={filters}
        setFilters={setFilters}
        data={data}
        productOptions={productOptions}
      />

      {isRefetchError && (
        <QueryErrorState
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
          title="Не вдалося оновити аналітику"
          description="Показано останні успішно завантажені дані."
          compact
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsStatCard label="Всього" value={stats.total} delta={stats.deltaTotal} />
        <AnalyticsStatCard label="Нові" value={stats.open} delta={stats.deltaOpen} tone="good" />
        <AnalyticsStatCard
          label="В роботі"
          value={stats.inProgress}
          delta={stats.deltaInProgress}
          tone="warn"
        />
        <AnalyticsStatCard label="Закриті" value={stats.closed} delta={stats.deltaClosed} tone="bad" />
      </div>

      <Card padding={false} className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Динаміка</p>
            <p className="text-2xl font-bold tracking-tight">{filtered.length} скарг</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> {analyticsPeriodLabel(period)}
          </div>
        </div>
        <AnalyticsSmoothBrandChart buckets={buckets} series={brandSeries} />
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AnalyticsBreakdownCard
          title="За статусом"
          rows={breakdownByStatus(filtered, data.statuses)}
        />
        <AnalyticsBreakdownCard
          title="За брендом"
          rows={breakdownByBrand(filtered, data.brands)}
        />
      </div>
    </div>
  )
}

async function loadAnalyticsData(): Promise<AnalyticsData> {
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
  return { complaints, statuses, severities, brands, products, networks, users }
}
