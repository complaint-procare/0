import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { Filter } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { MultiSelect } from '@/components/ui/multi-select'
import { cn } from '@/lib/utils'
import type { AnalyticsData, AnalyticsFilters, AnalyticsPeriod } from './analytics-types'

export function AnalyticsFiltersCard({
  filters,
  setFilters,
  data,
  productOptions,
}: {
  filters: AnalyticsFilters
  setFilters: Dispatch<SetStateAction<AnalyticsFilters>>
  data: AnalyticsData
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
            options={data.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
            selected={filters.brandIds}
            onChange={(brandIds) => setFilters((current) => ({ ...current, brandIds }))}
          />
        </FilterField>
        <FilterField label="Товари">
          <MultiSelect
            placeholder="Усі товари"
            options={productOptions}
            selected={filters.productNames}
            onChange={(productNames) => setFilters((current) => ({ ...current, productNames }))}
          />
        </FilterField>
        <FilterField label="Статуси">
          <MultiSelect
            placeholder="Усі статуси"
            options={data.statuses.map((status) => ({ value: status.id, label: status.name }))}
            selected={filters.statusIds}
            onChange={(statusIds) => setFilters((current) => ({ ...current, statusIds }))}
          />
        </FilterField>
        <FilterField label="Критичність">
          <MultiSelect
            placeholder="Усі рівні"
            options={data.severities.map((severity) => ({ value: severity.id, label: severity.name }))}
            selected={filters.severityIds}
            onChange={(severityIds) => setFilters((current) => ({ ...current, severityIds }))}
          />
        </FilterField>
        <FilterField label="Торгові мережі">
          <MultiSelect
            placeholder="Усі мережі"
            options={data.networks.map((network) => ({ value: network.id, label: network.name }))}
            selected={filters.networkIds}
            onChange={(networkIds) => setFilters((current) => ({ ...current, networkIds }))}
          />
        </FilterField>
        <FilterField label="Менеджери">
          <MultiSelect
            placeholder="Усі менеджери"
            options={data.users.map((user) => ({ value: user.id, label: user.full_name }))}
            selected={filters.managerIds}
            onChange={(managerIds) => setFilters((current) => ({ ...current, managerIds }))}
          />
        </FilterField>
      </div>
    </Card>
  )
}

export function AnalyticsPeriodToggle({
  value,
  onChange,
}: {
  value: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
}) {
  const options: { value: AnalyticsPeriod; label: string }[] = [
    { value: 'day', label: 'День' },
    { value: 'week', label: 'Тиждень' },
    { value: 'month', label: 'Місяць' },
  ]
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs transition-colors',
            value === option.value
              ? 'bg-foreground text-background font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
