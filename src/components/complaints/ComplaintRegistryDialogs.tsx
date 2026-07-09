import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Select, Toggle } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { insert, update } from '@/lib/db'
import { updateComplaint } from '@/lib/complaints'
import { useToast } from '@/components/ui/toast'
import { padComplaintNumber } from '@/lib/utils'
import { SYSTEM_REGISTRY_FIELDS } from './registry-types'
import type { Complaint, FieldDefinition } from '@/lib/types'

export function ComplaintStatusDialog({
  complaint,
  statuses,
  onClose,
  onSaved,
  actorId,
}: {
  complaint: Complaint | null
  statuses: {
    id: string
    name: string
    is_closed: boolean
    is_active: boolean
    sort_order: number
  }[]
  onClose: () => void
  onSaved: () => void | Promise<void>
  actorId: string
}) {
  const toast = useToast()
  const [statusId, setStatusId] = useState('')
  const currentStatus = statuses.find((status) => status.id === complaint?.status_id)
  const closed = currentStatus?.is_closed

  useEffect(() => {
    setStatusId('')
  }, [complaint?.id])

  return (
    <Dialog
      open={!!complaint}
      onClose={onClose}
      title="Змінити статус"
      description={
        complaint
          ? closed
            ? `Скарга #${padComplaintNumber(complaint.number)} закрита. Підтвердьте перевідкриття.`
            : `Скарга #${padComplaintNumber(complaint.number)} · Поточний статус: ${currentStatus?.name ?? '—'}`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Скасувати</Button>
          {closed ? (
            <Button
              onClick={async () => {
                if (!complaint) return
                try {
                  await updateComplaint({
                    id: complaint.id,
                    actor_id: actorId,
                    patch: {},
                    reopen: true,
                  })
                  await onSaved()
                  onClose()
                } catch (error) {
                  toast.show((error as Error).message, 'error')
                }
              }}
            >
              Перевідкрити
            </Button>
          ) : (
            <Button
              disabled={!statusId || statusId === complaint?.status_id}
              onClick={async () => {
                if (!complaint || !statusId) return
                try {
                  await updateComplaint({
                    id: complaint.id,
                    actor_id: actorId,
                    patch: { status_id: statusId },
                  })
                  await onSaved()
                  onClose()
                } catch (error) {
                  toast.show((error as Error).message, 'error')
                }
              }}
            >
              Підтвердити
            </Button>
          )}
        </>
      }
    >
      {!closed && (
        <Select value={statusId} onChange={(event) => setStatusId(event.target.value)} autoFocus>
          <option value="">Оберіть статус…</option>
          {statuses
            .filter((status) => status.is_active || status.id === complaint?.status_id)
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk'))
            .map((status) => (
              <option key={status.id} value={status.id} disabled={status.id === complaint?.status_id}>
                {status.name}
              </option>
            ))}
        </Select>
      )}
    </Dialog>
  )
}

export function ComplaintColumnsDialog({
  open,
  onClose,
  fields,
  entities,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  fields: FieldDefinition[]
  entities: { id: string; entity_key: string }[]
  onSaved: () => void | Promise<void>
}) {
  const toast = useToast()
  const complaintEntity = entities.find((entity) => entity.entity_key === 'complaints')
  const initial = useMemo<RegistryColumn[]>(() => {
    if (!complaintEntity) return []
    const persisted = fields
      .filter((field) => field.entity_id === complaintEntity.id && field.is_active && !field.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => ({
        id: field.id,
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        show_in_registry: field.show_in_registry,
        sort_order: field.sort_order,
      }))
    const missingSystemColumns = SYSTEM_REGISTRY_FIELDS
      .filter((field) => !persisted.some((item) => item.field_key === field.field_key))
      .map((field) => ({
        id: `system:${field.field_key}`,
        label: field.label,
        field_key: field.field_key,
        field_type: field.field_type,
        show_in_registry: true,
        sort_order: field.sort_order,
        isSynthetic: true,
      }))
    return [...persisted, ...missingSystemColumns].sort((a, b) => a.sort_order - b.sort_order)
  }, [complaintEntity, fields])
  const [items, setItems] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setItems(initial)
  }, [open, initial])

  const move = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    if (!complaintEntity) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const initialMap = new Map(initial.map((item) => [item.id, item]))
      await Promise.all(
        items.map((item, index) => {
          const before = initialMap.get(item.id)
          const sortOrder = (index + 1) * 10
          if (item.isSynthetic) {
            return insert('field_definitions', {
              entity_id: complaintEntity.id,
              field_key: item.field_key,
              label: item.label,
              field_type: item.field_type,
              is_system: true,
              is_required: false,
              is_active: true,
              is_visible: true,
              show_in_create: false,
              show_in_details: false,
              show_in_registry: item.show_in_registry,
              sort_order: sortOrder,
            })
          }
          const orderChanged = !before || orderOf(before, initial) !== sortOrder
          const visibilityChanged = !before || before.show_in_registry !== item.show_in_registry
          if (!orderChanged && !visibilityChanged) return null
          return update('field_definitions', item.id, {
            sort_order: sortOrder,
            show_in_registry: item.show_in_registry,
            updated_at: now,
          })
        }),
      )
      await onSaved()
      onClose()
    } catch (error) {
      toast.show((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Колонки реєстру"
      description="Стрілки змінюють порядок зліва направо. Перемикач — показати у таблиці."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Скасувати</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 text-right text-xs text-muted-foreground">{index + 1}.</span>
              <Toggle
                checked={item.show_in_registry}
                onChange={() =>
                  setItems((current) =>
                    current.map((value, itemIndex) =>
                      itemIndex === index
                        ? { ...value, show_in_registry: !value.show_in_registry }
                        : value,
                    ),
                  )
                }
                aria-label="Показувати в реєстрі"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{item.field_key}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <MoveButton
                disabled={index === 0}
                onClick={() => move(index, -1)}
                label="Лівіше"
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
              />
              <MoveButton
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                label="Правіше"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              />
            </div>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Полів немає.</p>}
      </ul>
    </Dialog>
  )
}

function MoveButton({
  disabled,
  onClick,
  label,
  icon,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  )
}

interface RegistryColumn {
  id: string
  label: string
  field_key: string
  field_type: FieldDefinition['field_type']
  show_in_registry: boolean
  sort_order: number
  isSynthetic?: boolean
}

function orderOf(item: RegistryColumn, initial: RegistryColumn[]) {
  const index = initial.findIndex((value) => value.id === item.id)
  return index === -1 ? -1 : (index + 1) * 10
}
