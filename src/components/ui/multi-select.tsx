import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiOption {
  value: string
  label: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Оберіть…',
  className,
  searchPlaceholder = 'Пошук…',
  maxLabels = 2,
}: {
  options: MultiOption[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  className?: string
  searchPlaceholder?: string
  maxLabels?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = options.filter((o) =>
    !query.trim() ? true : o.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val))
    else onChange([...selected, val])
  }

  const labels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean) as string[]

  const shown = labels.slice(0, maxLabels)
  const extra = labels.length - shown.length

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm transition-colors',
          'hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {shown.length === 0 && (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {shown.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
            >
              {l}
            </span>
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
              +{extra}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange([])
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Очистити"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-card-lg">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Нічого не знайдено</div>
            )}
            {filtered.map((o) => {
              const isSel = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="h-4 w-4 shrink-0 text-foreground" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
