import { useQuery } from '@tanstack/react-query'
import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { Field, Input, Toggle } from '@/components/ui/primitives'
import { list } from '@/lib/db'
import type { ComplaintStatus } from '@/lib/types'

export function StatusesPage() {
  const { data: statuses } = useQuery({
    queryKey: ['complaint_statuses'],
    queryFn: () => list('complaint_statuses'),
  })
  const nextSortOrder = Math.max(0, ...(statuses ?? []).map((status) => status.sort_order)) + 10

  return (
    <SimpleCrud<ComplaintStatus>
      title="Статуси"
      description="Статуси обробки скарг. Вимкнені статуси не пропонуються для нових змін, але залишаються в історії старих скарг."
      table="complaint_statuses"
      columns={[
        { key: 'name', label: 'Назва' },
        {
          key: 'sort_order',
          label: 'Порядок',
          className: 'w-28 font-mono text-xs',
          sortValue: (r) => r.sort_order,
        },
        {
          key: 'is_closed',
          label: 'Закриває скаргу',
          render: (r) => (r.is_closed ? 'Так' : 'Ні'),
          searchValue: (r) => (r.is_closed ? 'Так закриває' : 'Ні не закриває'),
          sortValue: (r) => r.is_closed,
        },
        {
          key: 'is_active',
          label: 'Активний',
          render: (r) => (r.is_active ? 'Так' : 'Ні'),
          searchValue: (r) => (r.is_active ? 'Так активний' : 'Ні вимкнений'),
          sortValue: (r) => r.is_active,
        },
      ]}
      defaultRow={() => ({
        name: '',
        sort_order: nextSortOrder,
        is_closed: false,
        is_active: true,
      })}
      validate={(row) => {
        if (!row.name?.trim()) return 'Вкажіть назву статусу'
        if (!Number.isFinite(Number(row.sort_order))) return 'Вкажіть коректний порядок'
        return null
      }}
      beforeDelete={async (row) => {
        const complaints = await list('complaints')
        if (complaints.some((c) => c.status_id === row.id)) {
          return 'Не можна видалити: статус використовується у скаргах. Вимкніть його замість видалення.'
        }
        return null
      }}
      renderForm={(row, set) => (
        <div className="space-y-4">
          <Field label="Назва" required>
            <Input
              value={row.name ?? ''}
              onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
              autoFocus
            />
          </Field>

          <Field label="Порядок">
            <Input
              type="number"
              value={row.sort_order ?? 0}
              onChange={(e) => set((r) => ({ ...r, sort_order: Number(e.target.value) }))}
            />
          </Field>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Активний</span>
                <span className="block text-xs text-muted-foreground">
                  Активні статуси доступні у формах створення та зміни скарги.
                </span>
              </span>
              <Toggle
                checked={!!row.is_active}
                onChange={(next) => set((r) => ({ ...r, is_active: next }))}
                aria-label="Активний статус"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Закриває скаргу</span>
                <span className="block text-xs text-muted-foreground">
                  При виборі такого статусу скарга вважається закритою.
                </span>
              </span>
              <Toggle
                checked={!!row.is_closed}
                onChange={(next) => set((r) => ({ ...r, is_closed: next }))}
                aria-label="Закриває скаргу"
              />
            </label>
          </div>
        </div>
      )}
    />
  )
}
