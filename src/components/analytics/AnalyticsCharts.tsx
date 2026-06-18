import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function AnalyticsStatCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string
  value: number
  delta: number
  tone?: 'good' | 'warn' | 'bad'
}) {
  const positive = delta >= 0
  const deltaTone =
    delta === 0
      ? 'pill-neutral'
      : positive
        ? tone === 'bad'
          ? 'pill-bad'
          : 'pill-good'
        : tone === 'good'
          ? 'pill-bad'
          : 'pill-warn'

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <span className={cn('badge', deltaTone, 'gap-0.5')}>
          {delta === 0 ? null : positive ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
    </Card>
  )
}

export function AnalyticsBarChart({
  buckets,
}: {
  buckets: { label: string; value: number; isPeak?: boolean }[]
}) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Немає даних для побудови графіка
      </div>
    )
  }
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1)
  return (
    <div className="space-y-2">
      <div className="flex h-48 items-end gap-1">
        {buckets.map((bucket, index) => {
          const height = (bucket.value / max) * 100
          return (
            <div key={index} className="group relative flex flex-1 flex-col items-center justify-end">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  bucket.isPeak ? 'bg-foreground' : 'bg-muted',
                  'group-hover:bg-foreground/70',
                )}
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${bucket.label}: ${bucket.value}`}
              />
              {bucket.value > 0 && bucket.isPeak && (
                <div className="absolute -top-5 text-[10px] font-semibold text-foreground">
                  {bucket.value}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-muted-foreground">
        {buckets.map((bucket, index) => (
          <div key={index} className="flex-1 text-center">
            {index % Math.max(1, Math.floor(buckets.length / 6)) === 0 ? bucket.label : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsBreakdownCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: number; tone?: string; color?: string }[]
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1
  return (
    <Card>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Немає даних</p>}
      <div className="space-y-2">
        {rows.map((row) => {
          const percentage = (row.value / total) * 100
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate">{row.label}</span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {row.value} · {percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', !row.color && (row.tone ?? 'bg-foreground'))}
                  style={{ width: `${percentage}%`, backgroundColor: row.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
