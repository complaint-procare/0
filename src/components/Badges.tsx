import type { CSSProperties } from 'react'
import type { ComplaintStatus, SeverityLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<string, string> = {
  'Новий': 'pill-good',
  'Нова': 'pill-good',
  'В роботі': 'pill-warn',
  'В роботі виробництво': 'pill-warn',
  'В роботі ВКЯ': 'pill-warn',
  'В роботі продакт-менеджер': 'pill-warn',
  'Очікує відповідь клієнта': 'pill-warn',
  'Очікує ВКЯ': 'pill-warn',
  'Закрито': 'pill-neutral',
  'Закрита': 'pill-neutral',
  'Відхилено': 'pill-bad',
  'Відхилена': 'pill-bad',
}

const SEVERITY_TONE: Record<string, string> = {
  'Інформаційна': 'pill-neutral',
  'Низька': 'pill-good',
  'Середня': 'pill-warn',
  'Висока': 'pill-bad',
  'Критична': 'pill-bad',
}

export function StatusBadge({
  id,
  statuses,
  className,
}: {
  id: string | null | undefined
  statuses: ComplaintStatus[]
  className?: string
}) {
  const s = statuses.find((x) => x.id === id)
  if (!s) {
    return (
      <span className="badge badge-liquid-status pill-neutral">
        <span className="relative z-10">—</span>
      </span>
    )
  }
  const style = colorToStatusBadgeStyle(s.color)
  if (style) {
    return (
      <span className={cn('badge badge-liquid-status', className)} style={style}>
        <span className="relative z-10 mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
        <span className="relative z-10">{s.name}</span>
      </span>
    )
  }
  const tone = STATUS_TONE[s.name] ?? (s.is_closed ? 'pill-neutral' : 'pill-good')
  return (
    <span className={cn('badge badge-liquid-status', tone, className)}>
      <span className="relative z-10 mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      <span className="relative z-10">{s.name}</span>
    </span>
  )
}

export function SeverityBadge({
  id,
  levels,
  className,
}: {
  id: string | null | undefined
  levels: SeverityLevel[]
  className?: string
}) {
  const s = levels.find((x) => x.id === id)
  if (!s) return <span className="badge pill-neutral">—</span>
  const style = colorToStatusBadgeStyle(s.color)
  if (style) {
    return <span className={cn('badge', className)} style={style}>{s.name}</span>
  }
  const tone = SEVERITY_TONE[s.name] ?? 'pill-neutral'
  return <span className={cn('badge', tone, className)}>{s.name}</span>
}

function colorToStatusBadgeStyle(color?: string | null): CSSProperties | undefined {
  const style = colorToBadgeStyle(color)
  if (!style) return undefined
  return {
    backgroundColor: style.backgroundColor,
    color: style.color,
  }
}

function colorToBadgeStyle(color?: string | null): CSSProperties | undefined {
  const rgb = hexToRgb(color)
  if (!rgb) return undefined
  const text = darken(rgb, 0.25)
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    boxShadow: `inset 0 0 0 1px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
    color: `rgb(${text.r}, ${text.g}, ${text.b})`,
  }
}

function hexToRgb(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const match = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(trimmed)
  if (!match) return null
  const raw = match[1]
  const hex =
    raw.length === 3
      ? raw.split('').map((char) => `${char}${char}`).join('')
      : raw
  const num = Number.parseInt(hex, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function darken(rgb: { r: number; g: number; b: number }, amount: number) {
  return {
    r: Math.max(0, Math.round(rgb.r * (1 - amount))),
    g: Math.max(0, Math.round(rgb.g * (1 - amount))),
    b: Math.max(0, Math.round(rgb.b * (1 - amount))),
  }
}
