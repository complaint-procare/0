import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { Field, Input } from '@/components/ui/primitives'
import type { Brand } from '@/lib/types'
import { list } from '@/lib/db'

export function BrandsPage() {
  return (
    <SimpleCrud<Brand>
      title="Бренди"
      description="Бренди косметики, що використовуються у скаргах."
      table="brands"
      columns={[
        { key: 'name', label: 'Назва' },
        { key: 'is_active', label: 'Активний', render: (r) => (r.is_active ? 'Так' : 'Ні') },
      ]}
      defaultRow={() => ({
        name: '',
        is_active: true,
        created_at: new Date().toISOString(),
      })}
      validate={(r) => (!r.name?.trim() ? 'Вкажіть назву' : null)}
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
        </div>
      )}
    />
  )
}
