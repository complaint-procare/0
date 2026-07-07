import { useState, type Dispatch, type SetStateAction } from 'react'
import { Filter } from 'lucide-react'
import { Button, Input } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { MultiSelect } from '@/components/ui/multi-select'
import type { ComplaintRegistryData, ComplaintRegistryFilters } from './registry-types'

const SOURCE_OPTIONS = [
  { value: 'network', label: 'Тільки мережі' },
  { value: 'client', label: 'Тільки клієнти' },
]

export function ComplaintRegistryFilterDialog({
  filters,
  setFilters,
  data,
}: {
  filters: ComplaintRegistryFilters
  setFilters: Dispatch<SetStateAction<ComplaintRegistryFilters>>
  data: ComplaintRegistryData | undefined
}) {
  const [open, setOpen] = useState(false)
  if (!data) return null

  const networkDisabled = filters.sourceTypes.length === 1 && filters.sourceTypes[0] === 'client'

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Filter className="h-3.5 w-3.5" /> Фільтри
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Фільтри" size="lg">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <MultiSelect
            options={data.statuses.map((status) => ({ value: status.id, label: status.name }))}
            selected={filters.statusIds}
            onChange={(statusIds) => setFilters((current) => ({ ...current, statusIds }))}
            placeholder="Усі статуси"
            searchPlaceholder="Пошук статусу..."
            maxLabels={1}
          />
          <MultiSelect
            options={data.severities.map((severity) => ({ value: severity.id, label: severity.name }))}
            selected={filters.severityIds}
            onChange={(severityIds) => setFilters((current) => ({ ...current, severityIds }))}
            placeholder="Усі рівні критичності"
            searchPlaceholder="Пошук критичності..."
            maxLabels={1}
          />
          <MultiSelect
            options={data.groups.map((group) => ({ value: group.id, label: group.name }))}
            selected={filters.groupIds}
            onChange={(groupIds) => setFilters((current) => ({ ...current, groupIds }))}
            placeholder="Усі групи скарг"
            searchPlaceholder="Пошук групи..."
            maxLabels={1}
          />
          <MultiSelect
            options={data.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
            selected={filters.brandIds}
            onChange={(brandIds) => setFilters((current) => ({ ...current, brandIds }))}
            placeholder="Усі бренди"
            searchPlaceholder="Пошук бренду..."
            maxLabels={1}
          />
          <MultiSelect
            options={SOURCE_OPTIONS}
            selected={filters.sourceTypes}
            onChange={(selected) => {
              const sourceTypes = selected.filter(isSourceType)
              setFilters((current) => ({
                ...current,
                sourceTypes,
                networkIds:
                  sourceTypes.length === 1 && sourceTypes[0] === 'client'
                    ? []
                    : current.networkIds,
              }))
            }}
            placeholder="Усі джерела"
            searchPlaceholder="Пошук джерела..."
            maxLabels={1}
          />
          <MultiSelect
            options={data.networks.map((network) => ({ value: network.id, label: network.name }))}
            selected={filters.networkIds}
            onChange={(networkIds) => setFilters((current) => ({ ...current, networkIds }))}
            placeholder="Усі мережі"
            searchPlaceholder="Пошук мережі..."
            disabled={networkDisabled}
            maxLabels={1}
          />
          <div className="sm:col-span-2">
            <MultiSelect
              options={data.users.map((user) => ({ value: user.id, label: user.full_name }))}
              selected={filters.managerIds}
              onChange={(managerIds) => setFilters((current) => ({ ...current, managerIds }))}
              placeholder="Усі менеджери"
              searchPlaceholder="Пошук менеджера..."
              maxLabels={2}
            />
          </div>
          <DateFilter
            label="Дата від"
            value={filters.from}
            onChange={(from) => setFilters((current) => ({ ...current, from }))}
          />
          <DateFilter
            label="Дата до"
            value={filters.to}
            onChange={(to) => setFilters((current) => ({ ...current, to }))}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Готово</Button>
        </div>
      </Dialog>
    </>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-1.5 overflow-hidden">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        type="date"
        className="w-full min-w-0 max-w-full"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function isSourceType(value: string): value is 'network' | 'client' {
  return value === 'network' || value === 'client'
}
