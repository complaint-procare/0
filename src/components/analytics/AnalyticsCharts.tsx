import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { AnalyticsBrandSeries, AnalyticsBucket } from './analytics-types'

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

export function AnalyticsSmoothBrandChart({
  buckets,
  series,
}: {
  buckets: AnalyticsBucket[]
  series: AnalyticsBrandSeries[]
}) {
  if (buckets.length === 0 || series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Немає даних для побудови графіка
      </div>
    )
  }

  const width = 640
  const height = 240
  const padding = { top: 58, right: 18, bottom: 26, left: 18 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const max = Math.max(...series.flatMap((item) => item.values), 1)
  const xFor = (index: number) =>
    buckets.length === 1
      ? padding.left + innerWidth / 2
      : padding.left + (innerWidth * index) / (buckets.length - 1)
  const yFor = (value: number) => padding.top + innerHeight - (value / max) * innerHeight
  const baseline = padding.top + innerHeight
  const labelStep = Math.max(1, Math.ceil(buckets.length / 5))
  const gridIndexes = buckets
    .map((_, index) => index)
    .filter((index) => index === 0 || index === buckets.length - 1 || index % labelStep === 0)

  return (
    <div className="space-y-3">
      <div className="relative h-60 w-full overflow-hidden rounded-xl bg-gradient-to-b from-white to-muted/20 px-2 py-2">
        <svg
          role="img"
          aria-label="Динаміка скарг за брендами"
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {series.map((item) => (
              <linearGradient
                key={`${item.brandId}-gradient`}
                id={`brand-gradient-${item.brandId}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={item.color} stopOpacity="0.16" />
                <stop offset="72%" stopColor={item.color} stopOpacity="0.04" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {gridIndexes.map((index) => {
            const x = xFor(index)
            return (
              <line
                key={buckets[index]?.key ?? index}
                x1={x}
                x2={x}
                y1={padding.top}
                y2={baseline}
                stroke="currentColor"
                className="text-border/60"
                strokeWidth="1"
                opacity="0.42"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}

          {series.map((item, index) => {
            const points = item.values.map((value, pointIndex) => ({
              x: xFor(pointIndex),
              y: yFor(value),
              value,
            }))
            const segments = visibleLineSegments(points)
            return (
              <g key={item.brandId} opacity={index > 0 ? 0.92 : 1}>
                {segments.map((segment, segmentIndex) => {
                  const linePath = softPath(segment)
                  return (
                    <g key={`${item.brandId}-${segmentIndex}`}>
                      <path
                        d={areaPath(linePath, segment, baseline)}
                        fill={`url(#brand-gradient-${item.brandId})`}
                      />
                      <path
                        d={linePath}
                        fill="none"
                        stroke={item.color}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.2"
                        opacity="0.96"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  )
                })}
              </g>
            )
          })}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={baseline}
            y2={baseline}
            stroke="#374151"
            strokeWidth="0.8"
            opacity="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {series.map((item) => (
          <div key={item.brandId} className="inline-flex min-w-0 items-center gap-2 text-foreground/85">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="max-w-36 truncate" title={item.label}>
              {item.label}
            </span>
            <span className="text-muted-foreground">{item.total}</span>
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

type ChartPoint = { x: number; y: number; value?: number }

function visibleLineSegments(points: ChartPoint[]) {
  const segments: ChartPoint[][] = []
  let start: number | null = null

  for (let index = 0; index < points.length; index++) {
    const hasValue = (points[index].value ?? 0) > 0
    if (hasValue && start === null) start = index
    const isLastPositive = start !== null && (!hasValue || index === points.length - 1)
    if (!isLastPositive) continue

    const segmentStartIndex = start
    if (segmentStartIndex === null) continue

    const positiveEnd = hasValue && index === points.length - 1 ? index : index - 1
    const segmentStart = Math.max(0, segmentStartIndex - 1)
    const segmentEnd = Math.min(points.length - 1, positiveEnd + 1)
    segments.push(points.slice(segmentStart, segmentEnd + 1))
    start = hasValue ? index : null
  }

  return segments
}
function softPath(points: ChartPoint[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${roundCoord(points[0].x)} ${roundCoord(points[0].y)}`

  let path = `M ${roundCoord(points[0].x)} ${roundCoord(points[0].y)}`
  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index]
    const next = points[index + 1]
    const distance = next.x - current.x
    path += ` C ${roundCoord(current.x + distance * 0.42)} ${roundCoord(current.y)}, ${roundCoord(next.x - distance * 0.42)} ${roundCoord(next.y)}, ${roundCoord(next.x)} ${roundCoord(next.y)}`
  }
  return path
}

function areaPath(path: string, points: ChartPoint[], baseline: number) {
  if (!path || points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${path} L ${roundCoord(last.x)} ${roundCoord(baseline)} L ${roundCoord(first.x)} ${roundCoord(baseline)} Z`
}
function roundCoord(value: number) {
  return Number(value.toFixed(2))
}
