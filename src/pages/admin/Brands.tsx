import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { Field, Input } from '@/components/ui/primitives'
import type { Brand } from '@/lib/types'
import { list } from '@/lib/db'

const DEFAULT_BRAND_COLOR = '#64748B'

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

export function BrandsPage() {
  return (
    <SimpleCrud<Brand>
      title="Бренди"
      description="Бренди косметики, що використовуються у скаргах."
      table="brands"
      columns={[
        { key: 'name', label: 'Назва' },
        {
          key: 'color',
          label: 'Колір',
          render: (r) => <ColorPreview color={r.color} />,
          searchValue: (r) => r.color,
          sortValue: (r) => r.color,
        },
        { key: 'is_active', label: 'Активний', render: (r) => (r.is_active ? 'Так' : 'Ні') },
      ]}
      defaultRow={() => ({
        name: '',
        color: DEFAULT_BRAND_COLOR,
        is_active: true,
        created_at: new Date().toISOString(),
      })}
      validate={(r) => {
        if (!r.name?.trim()) return 'Вкажіть назву'
        if (!normalizeHexColor(r.color)) return 'Оберіть коректний HEX-колір'
        return null
      }}
      beforeDelete={async (row) => {
        const products = await list('products')
        if (products.some((p) => p.brand_id === row.id)) {
          return 'Не можна видалити: бренд використовується у продуктах.'
        }
        const complaints = await list('complaints')
        if (complaints.some((c) => c.brand_id === row.id)) {
          return 'Не можна видалити: бренд використовується у скаргах.'
        }
        return null
      }}
      renderForm={(row, set) => (
        <div className="space-y-3">
          <Field label="Назва" required>
            <Input
              value={row.name ?? ''}
              onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
              autoFocus
            />
          </Field>
          <ColorField
            color={row.color}
            fallbackColor={DEFAULT_BRAND_COLOR}
            onChange={(color) => set((r) => ({ ...r, color }))}
          />
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
    <Field label="Колір" required hint="Колір застосовується до бейджа бренду в реєстрі скарг.">
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
          placeholder="#64748B"
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
