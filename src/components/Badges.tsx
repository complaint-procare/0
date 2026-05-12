import type { ComplaintStatus, SeverityLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<string, string> = {
  'Нова': 'pill-good',
  'В роботі': 'pill-warn',
  'Очікує відповідь клієнта': 'pill-warn',
  'Очікує ВКЯ': 'pill-warn',
  'Закрита': 'pill-neutral',
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
  id: string
  statuses: ComplaintStatus[]
  className?: string
}) {
  const s = statuses.find((x) => x.id === id)
  if (!s) return <span className="badge pill-neutral">—</span>
  const tone = STATUS_TONE[s.name] ?? (s.is_closed ? 'pill-neutral' : 'pill-good')
  return (
    <span className={cn('badge', tone, className)}>
      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.name}
    </span>
  )
}

export function SeverityBadge({
  id,
  levels,
  className,
}: {
  id: string
  levels: SeverityLevel[]
  className?: string
}) {
  const s = levels.find((x) => x.id === id)
  if (!s) return <span className="badge pill-neutral">—</span>
  const tone = SEVERITY_TONE[s.name] ?? 'pill-neutral'
  return <span className={cn('badge', tone, className)}>{s.name}</span>
}
