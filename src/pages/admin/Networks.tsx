import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { Field, Input } from '@/components/ui/primitives'
import type { RetailNetwork } from '@/lib/types'
import { list } from '@/lib/db'

export function NetworksPage() {
  return (
    <SimpleCrud<RetailNetwork>
      title="Торгові мережі"
      table="retail_networks"
      columns={[
        { key: 'name', label: 'Назва' },
        { key: 'is_active', label: 'Активна', render: (r) => (r.is_active ? 'Так' : 'Ні') },
      ]}
      defaultRow={() => ({
        name: '',
        is_active: true,
        created_at: new Date().toISOString(),
      })}
      validate={(r) => (!r.name?.trim() ? 'Вкажіть назву' : null)}
      beforeDelete={async (row) => {
        const complaints = await list('complaints')
        if (complaints.some((c) => c.retail_network_id === row.id)) {
          return 'Не можна видалити: мережа використовується у скаргах.'
        }
        return null
      }}
      renderForm={(row, set) => (
        <Field label="Назва" required>
          <Input
            value={row.name ?? ''}
            onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
            autoFocus
          />
        </Field>
      )}
    />
  )
}
