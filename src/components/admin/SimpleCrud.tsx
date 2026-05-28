import { useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, Input, Toggle } from '@/components/ui/primitives'
import { ConfirmDialog, Dialog } from '@/components/ui/dialog'
import { insert, list, remove, update } from '@/lib/db'
import type { TableName } from '@/lib/db'
import { supabaseEnabled } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { v4 as uuid } from 'uuid'

export interface CrudColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => ReactNode
  className?: string
  sortable?: boolean
  sortValue?: (row: T) => string | number | boolean | null | undefined
  searchValue?: (row: T) => string | number | boolean | null | undefined
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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
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

  const visibleRows = useMemo(() => {
    const rows = data ?? []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter((row) =>
          columns.some((column) => getSearchValue(row, column).toLowerCase().includes(q)),
        )
      : rows

    if (!sort) return filtered
    const column = columns.find((c) => String(c.key) === sort.key)
    if (!column || column.sortable === false) return filtered

    return [...filtered].sort((a, b) => {
      const result = compareSortValues(getSortValue(a, column), getSortValue(b, column))
      return sort.dir === 'asc' ? result : -result
    })
  }, [columns, data, search, sort])

  const toggleSort = (column: CrudColumn<T>) => {
    if (column.sortable === false) return
    const key = String(column.key)
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {data && data.length > 0 && (
            <div className="relative sm:w-72 lg:w-96">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Пошук: ${title.toLowerCase()}`}
              />
            </div>
          )}
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
        <div className="space-y-3">
          {visibleRows.length === 0 ? (
            <EmptyState title="Нічого не знайдено" />
          ) : (
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {columns.map((c) => {
                        const key = String(c.key)
                        const isSorted = sort?.key === key
                        const SortIcon = isSorted ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                        return (
                          <th key={key} className={`px-3 py-2 ${c.className ?? ''}`}>
                            {c.sortable === false ? (
                              c.label
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleSort(c)}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                aria-label={`Сортувати: ${c.label}`}
                              >
                                {c.label}
                                <SortIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </th>
                        )
                      })}
                      <th className="px-3 py-2 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.id} className={rowClassName(row)}>
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
        </div>
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

function rowClassName(row: { is_active?: boolean }) {
  return cn(
    'border-b border-border last:border-0 hover:bg-muted/40',
    'is_active' in row && (row.is_active ? 'bg-emerald-500/10' : 'bg-red-500/10'),
  )
}

function getSearchValue<T>(row: T, column: CrudColumn<T>): string {
  const value = column.searchValue?.(row) ?? column.sortValue?.(row) ?? getRawColumnValue(row, column)
  return value === null || value === undefined ? '' : String(value)
}

function getSortValue<T>(row: T, column: CrudColumn<T>) {
  return column.sortValue?.(row) ?? column.searchValue?.(row) ?? getRawColumnValue(row, column)
}

function getRawColumnValue<T>(row: T, column: CrudColumn<T>) {
  return (row as Record<string, unknown>)[column.key as string]
}

function compareSortValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '' ? 0 : 1
  if (b === null || b === undefined || b === '') return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)

  return String(a).localeCompare(String(b), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
}
