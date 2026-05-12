import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { Database, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Field, Input, Toggle } from '@/components/ui/primitives'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { insert, list, update } from '@/lib/db'
import { useToast } from '@/components/ui/toast'
import type { EntityDefinition, EntityRecord } from '@/lib/types'

interface FormState {
  id?: string
  entity_key: string
  singular_label: string
  plural_label: string
  icon: string
  sort_order: number
  show_in_navigation: boolean
  is_active: boolean
  is_visible: boolean
}

const DEFAULT: FormState = {
  entity_key: '',
  singular_label: '',
  plural_label: '',
  icon: 'Database',
  sort_order: 100,
  show_in_navigation: true,
  is_active: true,
  is_visible: true,
}

export function EntitiesPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<FormState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EntityDefinition | null>(null)
  const [recordsFor, setRecordsFor] = useState<EntityDefinition | null>(null)

  const { data } = useQuery({
    queryKey: ['entity_definitions'],
    queryFn: () => list('entity_definitions'),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['entity_definitions'] })

  const save = async () => {
    if (!editing) return
    if (!editing.singular_label.trim() || !editing.plural_label.trim() || !editing.entity_key.trim()) {
      toast.show('Заповніть назви та ключ', 'error')
      return
    }
    if (!/^[a-z][a-z0-9_]*$/.test(editing.entity_key)) {
      toast.show('Ключ: латинські літери, цифри та _, починається з літери', 'error')
      return
    }
    const all = await list('entity_definitions')
    const dup = all.find((e) => e.entity_key === editing.entity_key && e.id !== editing.id)
    if (dup) {
      toast.show('Сутність із таким ключем вже існує', 'error')
      return
    }
    const now = new Date().toISOString()
    if (editing.id) {
      await update('entity_definitions', editing.id, {
        entity_key: editing.entity_key,
        singular_label: editing.singular_label.trim(),
        plural_label: editing.plural_label.trim(),
        icon: editing.icon,
        sort_order: editing.sort_order,
        show_in_navigation: editing.show_in_navigation,
        is_active: editing.is_active,
        is_visible: editing.is_visible,
        updated_at: now,
      })
    } else {
      await insert('entity_definitions', {
        id: uuid(),
        entity_key: editing.entity_key,
        singular_label: editing.singular_label.trim(),
        plural_label: editing.plural_label.trim(),
        icon: editing.icon,
        sort_order: editing.sort_order,
        show_in_navigation: editing.show_in_navigation,
        is_system: false,
        is_active: editing.is_active,
        is_visible: editing.is_visible,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        updated_by: null,
      })
    }
    setEditing(null)
    refresh()
    toast.show('Збережено', 'success')
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Сутності</h1>
          <p className="text-sm text-muted-foreground">
            Конструктор довідників та кастомних сутностей. Системні видалити не можна.
          </p>
        </div>
        <Button onClick={() => setEditing(DEFAULT)}>
          <Plus className="h-4 w-4" /> Нова сутність
        </Button>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      ) : data.length === 0 ? (
        <EmptyState title="Сутностей немає" />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Назва</th>
                  <th className="px-3 py-2">Ключ</th>
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Порядок</th>
                  <th className="px-3 py-2">Активна</th>
                  <th className="px-3 py-2">Видима</th>
                  <th className="px-3 py-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {[...data]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">
                        {e.plural_label}
                        <span className="ml-1 text-xs text-muted-foreground">({e.singular_label})</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{e.entity_key}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.is_system ? (
                          <span className="badge bg-slate-100 text-slate-700">системна</span>
                        ) : (
                          <span className="badge bg-emerald-100 text-emerald-700">кастомна</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{e.sort_order}</td>
                      <td className="px-3 py-2">
                        <Toggle
                          checked={e.is_active}
                          onChange={async (v) => {
                            await update('entity_definitions', e.id, {
                              is_active: v,
                              updated_at: new Date().toISOString(),
                            })
                            refresh()
                          }}
                          aria-label="Активна"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await update('entity_definitions', e.id, {
                              is_visible: !e.is_visible,
                              updated_at: new Date().toISOString(),
                            })
                            refresh()
                          }}
                          aria-label="Видимість"
                        >
                          {e.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!e.is_system && (
                            <Button size="sm" variant="ghost" onClick={() => setRecordsFor(e)}>
                              <Database className="h-3.5 w-3.5" /> Записи
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing({
                                id: e.id,
                                entity_key: e.entity_key,
                                singular_label: e.singular_label,
                                plural_label: e.plural_label,
                                icon: e.icon ?? 'Database',
                                sort_order: e.sort_order,
                                show_in_navigation: e.show_in_navigation,
                                is_active: e.is_active,
                                is_visible: e.is_visible,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!e.is_system && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setConfirmDelete(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
        title={editing?.id ? 'Редагування сутності' : 'Нова сутність'}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Назва (одн.)" required>
                <Input
                  value={editing.singular_label}
                  onChange={(e) => setEditing((r) => ({ ...r!, singular_label: e.target.value }))}
                  placeholder="Бренд"
                />
              </Field>
              <Field label="Назва (мн.)" required>
                <Input
                  value={editing.plural_label}
                  onChange={(e) => setEditing((r) => ({ ...r!, plural_label: e.target.value }))}
                  placeholder="Бренди"
                />
              </Field>
            </div>
            <Field label="Технічний ключ" required hint="лат. літери, цифри, _">
              <Input
                value={editing.entity_key}
                onChange={(e) =>
                  setEditing((r) => ({ ...r!, entity_key: e.target.value.toLowerCase() }))
                }
                placeholder="brands"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Іконка">
                <Input
                  value={editing.icon}
                  onChange={(e) => setEditing((r) => ({ ...r!, icon: e.target.value }))}
                  placeholder="Database"
                />
              </Field>
              <Field label="Порядок">
                <Input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) =>
                    setEditing((r) => ({ ...r!, sort_order: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={editing.show_in_navigation}
                onChange={(v) => setEditing((r) => ({ ...r!, show_in_navigation: v }))}
              />
              Показувати в навігації
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={editing.is_active}
                onChange={(v) => setEditing((r) => ({ ...r!, is_active: v }))}
              />
              Активна
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={editing.is_visible}
                onChange={(v) => setEditing((r) => ({ ...r!, is_visible: v }))}
              />
              Видима
            </label>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          const records = await list('entity_records')
          if (records.some((r) => r.entity_id === confirmDelete.id)) {
            toast.show('Не можна видалити: сутність має записи. Архівуйте її.', 'error')
            return
          }
          await update('entity_definitions', confirmDelete.id, {
            deleted_at: new Date().toISOString(),
            is_active: false,
          })
          refresh()
          toast.show('Сутність архівовано', 'success')
        }}
        title="Видалити сутність?"
        description="Кастомні сутності позначаються як видалені. Дію можна відкотити, увімкнувши активність."
        confirmLabel="Видалити"
        destructive
      />

      <EntityRecordsDialog entity={recordsFor} onClose={() => setRecordsFor(null)} />
    </div>
  )
}

function EntityRecordsDialog({
  entity,
  onClose,
}: {
  entity: EntityDefinition | null
  onClose: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [name, setName] = useState('')

  const { data } = useQuery({
    queryKey: ['entity_records', entity?.id],
    queryFn: async () => {
      if (!entity) return [] as EntityRecord[]
      const rows = await list('entity_records')
      return rows.filter((r) => r.entity_id === entity.id)
    },
    enabled: !!entity,
  })

  const add = async () => {
    if (!entity || !name.trim()) return
    const now = new Date().toISOString()
    await insert('entity_records', {
      id: uuid(),
      entity_id: entity.id,
      display_name: name.trim(),
      data: {},
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    setName('')
    qc.invalidateQueries({ queryKey: ['entity_records', entity.id] })
    toast.show('Запис додано', 'success')
  }

  return (
    <Dialog
      open={!!entity}
      onClose={onClose}
      title={entity ? `Записи: ${entity.plural_label}` : ''}
      size="lg"
    >
      {entity && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Назва запису"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <Button onClick={add}>
              <Plus className="h-4 w-4" /> Додати
            </Button>
          </div>
          {data && data.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{r.display_name}</span>
                    {!r.is_active && <span className="badge bg-slate-100 text-slate-700">архів</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={r.is_active}
                      onChange={async (v) => {
                        await update('entity_records', r.id, {
                          is_active: v,
                          updated_at: new Date().toISOString(),
                        })
                        qc.invalidateQueries({ queryKey: ['entity_records', entity.id] })
                      }}
                      aria-label="Активний"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Записів немає.</p>
          )}
        </div>
      )}
    </Dialog>
  )
}
