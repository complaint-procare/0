import { SimpleCrud } from '@/components/admin/SimpleCrud'
import { Field, Input, Textarea } from '@/components/ui/primitives'
import type { Client } from '@/lib/types'

export function ClientsPage() {
  return (
    <SimpleCrud<Client>
      title="Клієнти"
      table="clients"
      columns={[
        { key: 'name', label: 'Назва' },
        { key: 'contact_person', label: 'Контактна особа' },
        { key: 'phone', label: 'Телефон' },
        { key: 'email', label: 'Email' },
        { key: 'is_active', label: 'Активний', render: (r) => (r.is_active ? 'Так' : 'Ні') },
      ]}
      defaultRow={() => ({
        name: '',
        contact_person: null,
        phone: null,
        email: null,
        notes: null,
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
            <Field label="Контактна особа">
              <Input
                value={row.contact_person ?? ''}
                onChange={(e) => set((r) => ({ ...r, contact_person: e.target.value }))}
              />
            </Field>
            <Field label="Телефон">
              <Input
                value={row.phone ?? ''}
                onChange={(e) => set((r) => ({ ...r, phone: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={row.email ?? ''}
              onChange={(e) => set((r) => ({ ...r, email: e.target.value }))}
            />
          </Field>
          <Field label="Коментар">
            <Textarea
              value={row.notes ?? ''}
              onChange={(e) => set((r) => ({ ...r, notes: e.target.value }))}
            />
          </Field>
        </div>
      )}
    />
  )
}
