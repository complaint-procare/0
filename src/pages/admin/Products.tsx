import { useQuery } from '@tanstack/react-query'
import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { ProductsExcelImport } from '@/components/admin/ProductsExcelImport'
import { Field, Input, Select } from '@/components/ui/primitives'
import type { Product } from '@/lib/types'
import { list } from '@/lib/db'
import { QueryErrorState } from '@/components/ui/query-state'

export function ProductsPage() {
  const {
    data: brands,
    error,
    refetch,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ['brands'],
    queryFn: () => list('brands'),
  })

  const brandName = (id: string | null) =>
    brands?.find((b) => b.id === id)?.name ?? '—'

  return (
    <div>
      {isError && (
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <QueryErrorState
            error={error}
            onRetry={refetch}
            isRetrying={isFetching}
            title="Не вдалося завантажити бренди"
            description="Продукти доступні, але назви та вибір брендів можуть бути неповними."
            compact
          />
        </div>
      )}
      <SimpleCrud<Product>
        title="Продукти"
        table="products"
        requireSupabase
        headerExtra={<ProductsExcelImport />}
        searchPlaceholder="Пошук: назва, ID або штрихкод…"
        getSearchText={(r) =>
          `${r.external_id ?? ''} ${r.name} ${r.sku ?? ''} ${brandName(r.brand_id)}`
        }
        columns={[
          { key: 'external_id', label: 'ID', className: 'font-mono text-xs' },
          { key: 'name', label: 'Назва' },
          { key: 'sku', label: 'SKU', className: 'font-mono text-xs' },
          {
            key: 'brand_id',
            label: 'Бренд',
            render: (r) => brandName(r.brand_id),
            searchValue: (r) => brandName(r.brand_id),
            sortValue: (r) => brandName(r.brand_id),
          },
          {
            key: 'is_active',
            label: 'Активний',
            render: (r) => (r.is_active ? 'Так' : 'Ні'),
            searchValue: (r) => (r.is_active ? 'Так активний' : 'Ні неактивний'),
            sortValue: (r) => r.is_active,
          },
        ]}
        defaultRow={() => ({
          external_id: '',
          name: '',
          sku: '',
          brand_id: null,
          is_active: true,
          created_at: new Date().toISOString(),
        })}
        validate={(r) => (!r.name?.trim() ? 'Вкажіть назву' : null)}
        renderForm={(row, set) => (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,12rem)_1fr]">
              <Field label="ID" hint="Необов’язково. Наприклад: 123 або внутрішній код товару.">
                <Input
                  value={row.external_id ?? ''}
                  onChange={(e) =>
                    set((r) => ({ ...r, external_id: e.target.value.trim() || null }))
                  }
                />
              </Field>
              <Field label="Назва" required>
                <Input
                  value={row.name ?? ''}
                  onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
                  autoFocus
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="SKU / штрихкод">
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
    </div>
  )
}
