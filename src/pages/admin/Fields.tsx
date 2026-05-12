import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Field, Input, Select, Toggle } from '@/components/ui/primitives'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { insert, list, remove, update } from '@/lib/db'
import { useToast } from '@/components/ui/toast'
import type { EntityDefinition, FieldDefinition, FieldType } from '@/lib/types'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Багаторядковий текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'boolean', label: 'Так/Ні' },
  { value: 'select', label: 'Список' },
  { value: 'reference', label: 'Посилання на сутність' },
]

interface FormState {
  id?: string
  entity_id: string
  field_key: string
  label: string
  field_type: FieldType
  reference_entity_id: string | null
  is_required: boolean
  is_active: boolean
  is_visible: boolean
  show_in_create: boolean
  show_in_details: boolean
  show_in_registry: boolean
  sort_order: number
  options_text: string
}

const defaultForm = (entityId: string): FormState => ({
  entity_id: entityId,
  field_key: '',
  label: '',
  field_type: 'text',
  reference_entity_id: null,
  is_required: false,
  is_active: true,
  is_visible: true,
  show_in_create: true,
  show_in_details: true,
  show_in_registry: false,
  sort_order: 100,
  options_text: '',
})

export function FieldsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [entityId, setEntityId] = useState<string>('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FieldDefinition | null>(null)

  const { data: entities } = useQuery({
    queryKey: ['entity_definitions'],
    queryFn: () => list('entity_definitions'),
  })
  const { data: fields, refetch: refetchFields } = useQuery({
    queryKey: ['field_definitions'],
    queryFn: () => list('field_definitions'),
  })

  if (entities && entities.length && !entityId) setEntityId(entities[0].id)

  const currentFields = (fields ?? [])
    .filter((f) => f.entity_id === entityId)
    .sort((a, b) => a.sort_order - b.sort_order)

  const save = async () => {
    if (!editing) return
    if (!editing.label.trim() || !editing.field_key.trim()) {
      toast.show('Заповніть назву й ключ', 'error')
      return
    }
    if (!/^[a-z][a-z0-9_]*$/.test(editing.field_key)) {
      toast.show('Ключ: латинські літери, цифри та _, починається з літери', 'error')
      return
    }
    const all = await list('field_definitions')
    const dup = all.find(
      (f) =>
        f.entity_id === editing.entity_id &&
        f.field_key === editing.field_key &&
        f.id !== editing.id,
    )
    if (dup) {
      toast.show('Поле з таким ключем уже існує', 'error')
      return
    }
    const options =
      editing.field_type === 'select'
        ? editing.options_text
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : null
    const now = new Date().toISOString()
    if (editing.id) {
      await update('field_definitions', editing.id, {
        label: editing.label,
        field_type: editing.field_type,
        reference_entity_id:
          editing.field_type === 'reference' ? editing.reference_entity_id : null,
        is_required: editing.is_required,
        is_active: editing.is_active,
        is_visible: editing.is_visible,
        show_in_create: editing.show_in_create,
        show_in_details: editing.show_in_details,
        show_in_registry: editing.show_in_registry,
        sort_order: editing.sort_order,
        options,
        updated_at: now,
      })
    } else {
      await insert('field_definitions', {
        id: uuid(),
        entity_id: editing.entity_id,
        field_key: editing.field_key,
        label: editing.label,
        field_type: editing.field_type,
        reference_entity_id:
          editing.field_type === 'reference' ? editing.reference_entity_id : null,
        is_system: false,
        is_required: editing.is_required,
        is_active: editing.is_active,
        is_visible: editing.is_visible,
        show_in_create: editing.show_in_create,
        show_in_details: editing.show_in_details,
        show_in_registry: editing.show_in_registry,
        sort_order: editing.sort_order,
        options,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
    }
    setEditing(null)
    qc.invalidateQueries({ queryKey: ['field_definitions'] })
    toast.show('Збережено', 'success')
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Поля</h1>
          <p className="text-sm text-muted-foreground">
            Конструктор полів. Системні поля можна приховувати, але не видаляти.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {(entities ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.plural_label}
              </option>
            ))}
          </Select>
          <Button onClick={() => entityId && setEditing(defaultForm(entityId))}>
            <Plus className="h-4 w-4" /> Додати поле
          </Button>
        </div>
      </div>

      {!fields ? (
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      ) : currentFields.length === 0 ? (
        <EmptyState title="Полів немає" />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Назва</th>
                  <th className="px-3 py-2">Ключ</th>
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Обов.</th>
                  <th className="px-3 py-2">Порядок</th>
                  <th className="px-3 py-2">Створення</th>
                  <th className="px-3 py-2">Деталі</th>
                  <th className="px-3 py-2">Реєстр</th>
                  <th className="px-3 py-2">Активне</th>
                  <th className="px-3 py-2">Видимість</th>
                  <th className="px-3 py-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {currentFields.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      {f.label}
                      {f.is_system && (
                        <span className="ml-1 text-xs text-muted-foreground">[sys]</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{f.field_key}</td>
                    <td className="px-3 py-2 text-xs">{labelType(f.field_type)}</td>
                    <td className="px-3 py-2">{f.is_required ? '✓' : ''}</td>
                    <td className="px-3 py-2">{f.sort_order}</td>
                    <td className="px-3 py-2">{f.show_in_create ? '✓' : ''}</td>
                    <td className="px-3 py-2">{f.show_in_details ? '✓' : ''}</td>
                    <td className="px-3 py-2">{f.show_in_registry ? '✓' : ''}</td>
                    <td className="px-3 py-2">
                      <Toggle
                        checked={f.is_active}
                        onChange={async (v) => {
                          await update('field_definitions', f.id, {
                            is_active: v,
                            updated_at: new Date().toISOString(),
                          })
                          refetchFields()
                        }}
                        aria-label="Активне"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Видимість"
                        onClick={async () => {
                          await update('field_definitions', f.id, {
                            is_visible: !f.is_visible,
                            updated_at: new Date().toISOString(),
                          })
                          refetchFields()
                        }}
                      >
                        {f.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditing({
                              id: f.id,
                              entity_id: f.entity_id,
                              field_key: f.field_key,
                              label: f.label,
                              field_type: f.field_type,
                              reference_entity_id: f.reference_entity_id,
                              is_required: f.is_required,
                              is_active: f.is_active,
                              is_visible: f.is_visible,
                              show_in_create: f.show_in_create,
                              show_in_details: f.show_in_details,
                              show_in_registry: f.show_in_registry,
                              sort_order: f.sort_order,
                              options_text: (f.options ?? []).join('\n'),
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={f.is_system}
                          className="text-destructive disabled:opacity-30"
                          onClick={() => setConfirmDelete(f)}
                          aria-label="Видалити"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        title={editing?.id ? 'Редагування поля' : 'Нове поле'}
        size="lg"
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
              <Field label="Назва" required>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing((r) => ({ ...r!, label: e.target.value }))}
                />
              </Field>
              <Field label="Технічний ключ" required>
                <Input
                  value={editing.field_key}
                  onChange={(e) =>
                    setEditing((r) => ({ ...r!, field_key: e.target.value.toLowerCase() }))
                  }
                />
              </Field>
              <Field label="Тип" required>
                <Select
                  value={editing.field_type}
                  onChange={(e) =>
                    setEditing((r) => ({ ...r!, field_type: e.target.value as FieldType }))
                  }
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
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
              {editing.field_type === 'reference' && (
                <Field label="Сутність-посилання" required>
                  <Select
                    value={editing.reference_entity_id ?? ''}
                    onChange={(e) =>
                      setEditing((r) => ({
                        ...r!,
                        reference_entity_id: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">Оберіть…</option>
                    {(entities ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.plural_label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {editing.field_type === 'select' && (
                <Field label="Опції" hint="кожен варіант з нового рядка або через кому">
                  <Input
                    value={editing.options_text}
                    onChange={(e) => setEditing((r) => ({ ...r!, options_text: e.target.value }))}
                    placeholder="A, B, C"
                  />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <ToggleRow
                label="Обов'язкове"
                checked={editing.is_required}
                onChange={(v) => setEditing((r) => ({ ...r!, is_required: v }))}
              />
              <ToggleRow
                label="У формі створення"
                checked={editing.show_in_create}
                onChange={(v) => setEditing((r) => ({ ...r!, show_in_create: v }))}
              />
              <ToggleRow
                label="На сторінці деталей"
                checked={editing.show_in_details}
                onChange={(v) => setEditing((r) => ({ ...r!, show_in_details: v }))}
              />
              <ToggleRow
                label="У реєстрі"
                checked={editing.show_in_registry}
                onChange={(v) => setEditing((r) => ({ ...r!, show_in_registry: v }))}
              />
              <ToggleRow
                label="Активне"
                checked={editing.is_active}
                onChange={(v) => setEditing((r) => ({ ...r!, is_active: v }))}
              />
              <ToggleRow
                label="Видиме"
                checked={editing.is_visible}
                onChange={(v) => setEditing((r) => ({ ...r!, is_visible: v }))}
              />
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          if (confirmDelete.is_system) {
            toast.show('Системні поля не можна видаляти', 'error')
            return
          }
          await remove('field_definitions', confirmDelete.id)
          qc.invalidateQueries({ queryKey: ['field_definitions'] })
          toast.show('Видалено', 'success')
        }}
        title="Видалити поле?"
        description={confirmDelete ? `«${confirmDelete.label}» буде видалено.` : undefined}
        confirmLabel="Видалити"
        destructive
      />
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <Toggle checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  )
}

function labelType(t: FieldType): string {
  return FIELD_TYPES.find((x) => x.value === t)?.label ?? t
}
