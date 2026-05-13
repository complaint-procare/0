import { useQuery } from '@tanstack/react-query'
import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { ProductsExcelImport } from '@/components/admin/ProductsExcelImport'
import { Field, Input, Select } from '@/components/ui/primitives'
import type { Product } from '@/lib/types'
import { list } from '@/lib/db'

export function ProductsPage() {
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => list('brands'),
  })


  const brandName = (id: string | null) =>
    brands?.find((b) => b.id === id)?.name ?? '—'

  return (
    <SimpleCrud<Product>
      title="Продукти"
      table="products"
      requireSupabase
      headerExtra={<ProductsExcelImport />}
      columns={[
        { key: 'name', label: 'Назва' },
        { key: 'sku', label: 'SKU', className: 'font-mono text-xs' },
        { key: 'brand_id', label: 'Бренд', render: (r) => brandName(r.brand_id) },
        { key: 'is_active', label: 'Активний', render: (r) => (r.is_active ? 'Так' : 'Ні') },
      ]}
      defaultRow={() => ({
        name: '',
        sku: '',
        brand_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
      })}
      validate={(r) => (!r.name?.trim() ? 'Вкажіть назву' : null)}
      renderForm={(row, set) => (
        <div className="space-y-3">
          <Field label="Назва" required>
            <Input
              value={row.name ?? ''}
              onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input
                value={row.sku ?? ''}
                onChange={(e) => set((r) => ({ ...r, sku: e.target.value }))}
              />
            </Field>
            <Field label="Бренд">
              <Select
                value={row.brand_id ?? ''}
                onChange={(e) => set((r) => ({ ...r, brand_id: e.target.value || null }))}
              >
                <option value="">—</option>
                {brands?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}
    />
  )
}
