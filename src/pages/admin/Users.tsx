import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { Pencil, Plus, ShieldX, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Field, Input, Select, Toggle } from '@/components/ui/primitives'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { insert, list, remove, update } from '@/lib/db'
import { useToast } from '@/components/ui/toast'
import { ROLE_LABELS, type Role, type User } from '@/lib/types'
import { hashPin } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

interface FormState {
  id?: string
  full_name: string
  role: Role
  pin: string
  is_active: boolean
}

const DEFAULT: FormState = { full_name: '', role: 'manager', pin: '', is_active: true }

export function UsersPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { session } = useAuth()
  const [editing, setEditing] = useState<FormState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const { data } = useQuery({ queryKey: ['users'], queryFn: () => list('users') })

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const save = async () => {
    if (!editing) return
    if (!editing.full_name.trim()) {
      toast.show('Вкажіть ПІБ', 'error')
      return
    }
    if (editing.pin && !/^\d{4}$/.test(editing.pin)) {
      toast.show('PIN має складатись із 4 цифр', 'error')
      return
    }
    if (!editing.id && !editing.pin) {
      toast.show('PIN обовʼязковий для нового користувача', 'error')
      return
    }
    if (editing.pin) {
      const hash = await hashPin(editing.pin)
      const all = await list('users')
      const dup = all.find((u) => u.pin_hash === hash && u.id !== editing.id)
      if (dup) {
        toast.show('Такий PIN вже використовується', 'error')
        return
      }
    }
    try {
      if (editing.id) {
        const patch: Partial<User> = {
          full_name: editing.full_name.trim(),
          role: editing.role,
          is_active: editing.is_active,
          updated_at: new Date().toISOString(),
        }
        if (editing.pin) patch.pin_hash = await hashPin(editing.pin)
        await update('users', editing.id, patch)
        toast.show('Збережено', 'success')
      } else {
        const now = new Date().toISOString()
        await insert('users', {
          id: uuid(),
          full_name: editing.full_name.trim(),
          role: editing.role,
          pin_hash: await hashPin(editing.pin),
          is_active: editing.is_active,
          created_at: now,
          updated_at: now,
        })
        toast.show('Додано', 'success')
      }
      setEditing(null)
      refresh()
    } catch (e) {
      toast.show((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Користувачі</h1>
          <p className="text-sm text-muted-foreground">PIN-код визначає людину та її роль.</p>
        </div>
        <Button onClick={() => setEditing(DEFAULT)}>
          <Plus className="h-4 w-4" /> Додати
        </Button>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      ) : data.length === 0 ? (
        <EmptyState title="Користувачів немає" />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">ПІБ</th>
                  <th className="px-3 py-2">Роль</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      {u.full_name}
                      {u.id === session?.user_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(ви)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{ROLE_LABELS[u.role]}</td>
                    <td className="px-3 py-2">
                      <Toggle
                        checked={u.is_active}
                        onChange={async (v) => {
                          await update('users', u.id, {
                            is_active: v,
                            updated_at: new Date().toISOString(),
                          })
                          refresh()
                        }}
                        disabled={u.id === session?.user_id}
                        aria-label="Активний"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditing({
                              id: u.id,
                              full_name: u.full_name,
                              role: u.role,
                              pin: '',
                              is_active: u.is_active,
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={u.id === session?.user_id}
                          onClick={() => setConfirmDelete(u)}
                        >
                          {u.id === session?.user_id ? (
                            <ShieldX className="h-3.5 w-3.5" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редагування користувача' : 'Новий користувач'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
            <Button onClick={save}>Зберегти</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="ПІБ" required>
              <Input
                value={editing.full_name}
                onChange={(e) => setEditing((r) => ({ ...r!, full_name: e.target.value }))}
                autoFocus
              />
            </Field>
            <Field label="Роль" required>
              <Select
                value={editing.role}
                onChange={(e) => setEditing((r) => ({ ...r!, role: e.target.value as Role }))}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="PIN"
              required={!editing.id}
              hint={
                editing.id
                  ? 'Залиште порожнім, щоб не змінювати'
                  : 'Має бути 4 цифри й унікальний серед користувачів'
              }
            >
              <Input
                value={editing.pin}
                onChange={(e) =>
                  setEditing((r) => ({ ...r!, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                }
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={editing.is_active}
                onChange={(v) => setEditing((r) => ({ ...r!, is_active: v }))}
              />
              Активний
            </label>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          const complaints = await list('complaints')
          if (
            complaints.some(
              (c) => c.manager_id === confirmDelete.id || c.created_by === confirmDelete.id,
            )
          ) {
            toast.show('Не можна видалити: користувач уже використовується у скаргах', 'error')
            return
          }
          await remove('users', confirmDelete.id)
          refresh()
          toast.show('Видалено', 'success')
        }}
        title="Видалити користувача?"
        description={confirmDelete ? `«${confirmDelete.full_name}» буде видалено.` : undefined}
        confirmLabel="Видалити"
        destructive
      />
    </div>
  )
}
