import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Toggle } from '@/components/ui/primitives'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { insert, list, remove, update } from '@/lib/db'
import type { TableName } from '@/lib/db'
import { supabaseEnabled } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { v4 as uuid } from 'uuid'

export interface CrudColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
  className?: string
}

interface SimpleCrudProps<T extends { id: string; is_active?: boolean }> {
  title: string
  description?: string
  table: TableName
  columns: CrudColumn<T>[]
  defaultRow: () => Omit<T, 'id'>
  renderForm: (
    row: Partial<T>,
    setRow: React.Dispatch<React.SetStateAction<Partial<T>>>,
  ) => ReactNode
  validate?: (row: Partial<T>) => string | null
  beforeDelete?: (row: T) => Promise<string | null>
  headerExtra?: ReactNode
  requireSupabase?: boolean
}

export function SimpleCrud<T extends { id: string; is_active?: boolean; name?: string }>(
  props: SimpleCrudProps<T>,
) {
  const {
    title,
    description,
    table,
    columns,
    defaultRow,
    renderForm,
    validate,
    beforeDelete,
    headerExtra,
    requireSupabase,
  } = props
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<T> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null)
  const supabaseRequiredButMissing = !!requireSupabase && !supabaseEnabled

  const showSupabaseRequired = () => {
    toast.show(
      'Для цієї дії потрібне підключення до Supabase. Перезапустіть або redeploy застосунок з VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY.',
      'error',
    )
  }

  const { data } = useQuery({
    queryKey: [table],
    queryFn: () => list(table) as unknown as Promise<T[]>,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: [table] })

  const save = async () => {
    if (!editing) return
    if (supabaseRequiredButMissing) {
      showSupabaseRequired()
      return
    }
    const err = validate?.(editing)
    if (err) {
      toast.show(err, 'error')
      return
    }
    try {
      if (editing.id) {
        await update(table, editing.id, editing as never)
        toast.show('Збережено', 'success')
      } else {
        await insert(table, { ...(editing as object), id: uuid() } as never)
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
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <Button
            onClick={() => {
              if (supabaseRequiredButMissing) {
                showSupabaseRequired()
                return
              }
              setEditing(defaultRow() as Partial<T>)
            }}
          >
            <Plus className="h-4 w-4" /> Додати
          </Button>
        </div>
      </div>

      {supabaseRequiredButMissing && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Товари не будуть записані локально. Потрібно активне підключення до Supabase.
        </div>
      )}

      {!data ? (
        <p className="text-sm text-muted-foreground">Завантаження…</p>
      ) : data.length === 0 ? (
        <EmptyState title="Записів немає" />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th key={String(c.key)} className={`px-3 py-2 ${c.className ?? ''}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    {columns.map((c) => (
                      <td key={String(c.key)} className={`px-3 py-2 ${c.className ?? ''}`}>
                        {c.render
                          ? c.render(row)
                          : String((row as Record<string, unknown>)[c.key as string] ?? '—')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {'is_active' in row && (
                          <div className="flex items-center pr-1">
                            <Toggle
                              checked={!!row.is_active}
                              onChange={async (next) => {
                                if (supabaseRequiredButMissing) {
                                  showSupabaseRequired()
                                  return
                                }
                                await update(table, row.id, { is_active: next } as never)
                                refresh()
                              }}
                              aria-label="Активний"
                            />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(row)}
                          aria-label="Редагувати"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (supabaseRequiredButMissing) {
                              showSupabaseRequired()
                              return
                            }
                            if (beforeDelete) {
                              const reason = await beforeDelete(row)
                              if (reason) {
                                toast.show(reason, 'error')
                                return
                              }
                            }
                            setConfirmDelete(row)
                          }}
                          aria-label="Видалити"
                          className="text-destructive hover:bg-destructive/10"
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
        title={editing?.id ? 'Редагування' : 'Новий запис'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
            <Button onClick={save}>Зберегти</Button>
          </>
        }
      >
        {editing && renderForm(editing, setEditing as React.Dispatch<React.SetStateAction<Partial<T>>>)}
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          if (supabaseRequiredButMissing) {
            showSupabaseRequired()
            return
          }
          await remove(table, confirmDelete.id)
          refresh()
          toast.show('Видалено', 'success')
        }}
        title="Видалити запис?"
        description={confirmDelete?.name ? `«${confirmDelete.name}» буде видалено.` : 'Дію не можна скасувати.'}
        confirmLabel="Видалити"
        destructive
      />
    </div>
  )
}
