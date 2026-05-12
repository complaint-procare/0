import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AutocompleteOption<T> {
  key: string
  label: string
  hint?: string
  value: T
}

interface AutocompleteProps<T> {
  value: string
  onChange: (next: string) => void
  onSelect: (option: AutocompleteOption<T>) => void
  options: AutocompleteOption<T>[]
  placeholder?: string
  className?: string
  emptyHint?: ReactNode
  inputMode?: 'text' | 'numeric'
  maxSuggestions?: number
}

export function Autocomplete<T>({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  className,
  emptyHint,
  inputMode = 'text',
  maxSuggestions = 8,
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  const tokens = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  const matches = tokens.length
    ? options
        .filter((o) => {
          const hay = `${o.label} ${o.hint ?? ''}`.toLowerCase()
          return tokens.every((t) => hay.includes(t))
        })
        .slice(0, maxSuggestions)
    : options.slice(0, maxSuggestions)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const choose = (idx: number) => {
    const opt = matches[idx]
    if (!opt) return
    onSelect(opt)
    setOpen(false)
    setActiveIdx(-1)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(matches.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && open) {
        e.preventDefault()
        choose(activeIdx)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIdx(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        className="input"
      />
      {open && (matches.length > 0 || emptyHint) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface py-1 text-sm shadow-xl">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyHint}</div>
          ) : (
            matches.map((opt, idx) => (
              <button
                key={opt.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors',
                  idx === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.hint && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{opt.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
