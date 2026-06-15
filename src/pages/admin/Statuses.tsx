import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { SeverityBadge, StatusBadge } from '@/components/Badges'
import { Button, Field, Input, Toggle } from '@/components/ui/primitives'
import { list } from '@/lib/db'
import type { ComplaintGroup, ComplaintStatus, SeverityLevel } from '@/lib/types'

const DEFAULT_STATUS_COLOR = '#2563EB'
const DEFAULT_SEVERITY_COLOR = '#F59E0B'

const COLOR_PRESETS = [
  { label: 'Сірий', value: '#64748B' },
  { label: 'Синій', value: '#2563EB' },
  { label: 'Блакитний', value: '#0891B2' },
  { label: 'Зелений', value: '#059669' },
  { label: 'Лайм', value: '#65A30D' },
  { label: 'Жовтий', value: '#D97706' },
  { label: 'Помаранчевий', value: '#EA580C' },
  { label: 'Червоний', value: '#DC2626' },
  { label: 'Рожевий', value: '#DB2777' },
  { label: 'Фіолетовий', value: '#7C3AED' },
]

export function StatusesPage() {
  const [section, setSection] = useState<'statuses' | 'severities' | 'groups'>('statuses')
  const { data: statuses } = useQuery({
    queryKey: ['complaint_statuses'],
    queryFn: () => list('complaint_statuses'),
  })
  const { data: severities } = useQuery({
    queryKey: ['severity_levels'],
    queryFn: () => list('severity_levels'),
  })
  const { data: groups } = useQuery({
    queryKey: ['complaint_groups'],
    queryFn: () => list('complaint_groups'),
  })
  const nextStatusSortOrder =
    Math.max(0, ...(statuses ?? []).map((status) => status.sort_order)) + 10
  const nextSeveritySortOrder =
    Math.max(0, ...(severities ?? []).map((severity) => severity.sort_order)) + 10
  const nextGroupSortOrder =
    Math.max(0, ...(groups ?? []).map((group) => group.sort_order)) + 10

  return (
    <div>
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          <Button
            type="button"
            size="sm"
            variant={section === 'statuses' ? 'primary' : 'ghost'}
            onClick={() => setSection('statuses')}
          >
            Статуси скарг
          </Button>
          <Button
            type="button"
            size="sm"
            variant={section === 'severities' ? 'primary' : 'ghost'}
            onClick={() => setSection('severities')}
          >
            Критичність
          </Button>
          <Button
            type="button"
            size="sm"
            variant={section === 'groups' ? 'primary' : 'ghost'}
            onClick={() => setSection('groups')}
          >
            Групи скарг
          </Button>
        </div>
      </div>

      {section === 'statuses' && <ComplaintStatusesCrud nextSortOrder={nextStatusSortOrder} />}
      {section === 'severities' && <SeverityLevelsCrud nextSortOrder={nextSeveritySortOrder} />}
      {section === 'groups' && <ComplaintGroupsCrud nextSortOrder={nextGroupSortOrder} />}
    </div>
  )
}

function ComplaintStatusesCrud({ nextSortOrder }: { nextSortOrder: number }) {
  return (
    <SimpleCrud<ComplaintStatus>
      title="Статуси скарг"
      description="Статуси обробки скарг. Вимкнені статуси не пропонуються для нових змін, але залишаються в історії старих скарг."
      table="complaint_statuses"
      columns={[
        {
          key: 'name',
          label: 'Назва',
          render: (r) => <StatusBadge id={r.id} statuses={[r]} />,
          searchValue: (r) => r.name,
        },
        {
          key: 'color',
          label: 'Колір',
          render: (r) => <ColorPreview color={r.color} />,
          searchValue: (r) => r.color,
          sortValue: (r) => r.color,
        },
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
        color: DEFAULT_STATUS_COLOR,
        sort_order: nextSortOrder,
        is_closed: false,
        is_active: true,
      })}
      validate={(row) => validateStatusRow(row)}
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

          <ColorField
            color={row.color}
            fallbackColor={DEFAULT_STATUS_COLOR}
            onChange={(color) => set((r) => ({ ...r, color }))}
          />

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

function ComplaintGroupsCrud({ nextSortOrder }: { nextSortOrder: number }) {
  return (
    <SimpleCrud<ComplaintGroup>
      title="Групи скарг"
      description="Довідник груп скарг для форми створення, редагування та фільтрів реєстру."
      table="complaint_groups"
      columns={[
        {
          key: 'name',
          label: 'Назва',
          searchValue: (r) => r.name,
        },
        {
          key: 'sort_order',
          label: 'Порядок',
          className: 'w-28 font-mono text-xs',
          sortValue: (r) => r.sort_order,
        },
        {
          key: 'is_active',
          label: 'Активна',
          render: (r) => (r.is_active ? 'Так' : 'Ні'),
          searchValue: (r) => (r.is_active ? 'Так активна' : 'Ні вимкнена'),
          sortValue: (r) => r.is_active,
        },
      ]}
      defaultRow={() => ({
        name: '',
        sort_order: nextSortOrder,
        is_active: true,
      })}
      validate={(row) => validateComplaintGroupRow(row)}
      beforeDelete={async (row) => {
        const complaints = await list('complaints')
        if (complaints.some((c) => c.complaint_group_id === row.id)) {
          return 'Не можна видалити: група використовується у скаргах. Вимкніть її замість видалення.'
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

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Активна</span>
                <span className="block text-xs text-muted-foreground">
                  Активні групи доступні у формі створення та редагування скарги.
                </span>
              </span>
              <Toggle
                checked={!!row.is_active}
                onChange={(next) => set((r) => ({ ...r, is_active: next }))}
                aria-label="Активна група скарги"
              />
            </label>
          </div>
        </div>
      )}
    />
  )
}

function SeverityLevelsCrud({ nextSortOrder }: { nextSortOrder: number }) {
  return (
    <SimpleCrud<SeverityLevel>
      title="Критичність"
      description="Рівні критичності для скарг. Вимкнені рівні не пропонуються в нових скаргах, але залишаються у вже створених записах."
      table="severity_levels"
      columns={[
        {
          key: 'name',
          label: 'Назва',
          render: (r) => <SeverityBadge id={r.id} levels={[r]} />,
          searchValue: (r) => r.name,
        },
        {
          key: 'color',
          label: 'Колір',
          render: (r) => <ColorPreview color={r.color} />,
          searchValue: (r) => r.color,
          sortValue: (r) => r.color,
        },
        {
          key: 'sort_order',
          label: 'Порядок',
          className: 'w-28 font-mono text-xs',
          sortValue: (r) => r.sort_order,
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
        color: DEFAULT_SEVERITY_COLOR,
        sort_order: nextSortOrder,
        is_active: true,
      })}
      validate={(row) => validateSeverityRow(row)}
      beforeDelete={async (row) => {
        const complaints = await list('complaints')
        if (complaints.some((c) => c.severity_id === row.id)) {
          return 'Не можна видалити: критичність використовується у скаргах. Вимкніть її замість видалення.'
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

          <ColorField
            color={row.color}
            fallbackColor={DEFAULT_SEVERITY_COLOR}
            onChange={(color) => set((r) => ({ ...r, color }))}
          />

          <Field label="Порядок">
            <Input
              type="number"
              value={row.sort_order ?? 0}
              onChange={(e) => set((r) => ({ ...r, sort_order: Number(e.target.value) }))}
            />
          </Field>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Активна</span>
                <span className="block text-xs text-muted-foreground">
                  Активні рівні доступні у формах створення та редагування скарги.
                </span>
              </span>
              <Toggle
                checked={!!row.is_active}
                onChange={(next) => set((r) => ({ ...r, is_active: next }))}
                aria-label="Активна критичність"
              />
            </label>
          </div>
        </div>
      )}
    />
  )
}

function ColorField({
  color,
  fallbackColor,
  onChange,
}: {
  color?: string
  fallbackColor: string
  onChange: (color: string) => void
}) {
  const pickerColor = normalizeHexColor(color) ?? fallbackColor

  return (
    <Field label="Колір" required hint="Колір застосовується до бейджів у реєстрі та деталях скарг.">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerColor}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
          aria-label="Вибрати колір"
        />
        <Input
          value={color ?? ''}
          onChange={(e) => onChange(formatColorInput(e.target.value))}
          placeholder="#2563EB"
          className="font-mono uppercase"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            title={preset.label}
            aria-label={`Колір: ${preset.label}`}
            className="h-7 w-7 rounded-full border border-border ring-offset-2 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-foreground"
            style={{ backgroundColor: preset.value }}
          />
        ))}
      </div>
    </Field>
  )
}

function ColorPreview({ color }: { color?: string | null }) {
  const hex = normalizeHexColor(color)
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-4 w-4 rounded-full border border-border"
        style={{ backgroundColor: hex ?? '#E2E8F0' }}
      />
      <span className="font-mono text-xs">{hex ?? '—'}</span>
    </span>
  )
}

function validateStatusRow(row: Partial<ComplaintStatus>) {
  if (!row.name?.trim()) return 'Вкажіть назву статусу'
  if (!normalizeHexColor(row.color)) return 'Оберіть коректний HEX-колір'
  if (!Number.isFinite(Number(row.sort_order))) return 'Вкажіть коректний порядок'
  return null
}

function validateSeverityRow(row: Partial<SeverityLevel>) {
  if (!row.name?.trim()) return 'Вкажіть назву критичності'
  if (!normalizeHexColor(row.color)) return 'Оберіть коректний HEX-колір'
  if (!Number.isFinite(Number(row.sort_order))) return 'Вкажіть коректний порядок'
  return null
}

function validateComplaintGroupRow(row: Partial<ComplaintGroup>) {
  if (!row.name?.trim()) return 'Вкажіть назву групи скарги'
  if (!Number.isFinite(Number(row.sort_order))) return 'Вкажіть коректний порядок'
  return null
}

function formatColorInput(value: string) {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function normalizeHexColor(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const match = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(trimmed)
  if (!match) return null
  const raw = match[1].toUpperCase()
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
  }
  return `#${raw}`
}
