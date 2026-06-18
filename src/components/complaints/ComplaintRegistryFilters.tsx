import { useState, type Dispatch, type SetStateAction } from 'react'
import { Filter } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import type { ComplaintRegistryData, ComplaintRegistryFilters } from './registry-types'

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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Filter className="h-3.5 w-3.5" /> Фільтри
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Фільтри" size="lg">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            value={filters.statusId}
            onChange={(event) => setFilters((current) => ({ ...current, statusId: event.target.value }))}
          >
            <option value="">Усі статуси</option>
            {data.statuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </Select>
          <Select
            value={filters.severityId}
            onChange={(event) => setFilters((current) => ({ ...current, severityId: event.target.value }))}
          >
            <option value="">Усі рівні критичності</option>
            {data.severities.map((severity) => (
              <option key={severity.id} value={severity.id}>{severity.name}</option>
            ))}
          </Select>
          <Select
            value={filters.groupId}
            onChange={(event) => setFilters((current) => ({ ...current, groupId: event.target.value }))}
          >
            <option value="">Усі групи скарг</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </Select>
          <Select
            value={filters.brandId}
            onChange={(event) => setFilters((current) => ({ ...current, brandId: event.target.value }))}
          >
            <option value="">Усі бренди</option>
            {data.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </Select>
          <Select
            value={filters.sourceType}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sourceType: event.target.value as ComplaintRegistryFilters['sourceType'],
                networkId: event.target.value === 'client' ? '' : current.networkId,
              }))
            }
          >
            <option value="">Усі джерела</option>
            <option value="network">Тільки мережі</option>
            <option value="client">Тільки клієнти</option>
          </Select>
          <Select
            value={filters.networkId}
            onChange={(event) => setFilters((current) => ({ ...current, networkId: event.target.value }))}
            disabled={filters.sourceType === 'client'}
          >
            <option value="">Усі мережі</option>
            {data.networks.map((network) => (
              <option key={network.id} value={network.id}>{network.name}</option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Select
              value={filters.managerId}
              onChange={(event) => setFilters((current) => ({ ...current, managerId: event.target.value }))}
            >
              <option value="">Усі менеджери</option>
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </Select>
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
