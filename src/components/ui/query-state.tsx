import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './primitives'
import { cn } from '@/lib/utils'

export function QueryErrorState({
  error,
  onRetry,
  isRetrying = false,
  title = 'Не вдалося завантажити дані',
  description = 'Перевірте з’єднання та спробуйте ще раз.',
  compact = false,
}: {
  error?: unknown
  onRetry: () => void | Promise<unknown>
  isRetrying?: boolean
  title?: string
  description?: string
  compact?: boolean
}) {
  const details = describeQueryError(error)

  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-destructive/30 bg-destructive/5',
        compact ? 'p-3' : 'p-6',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap gap-3',
          compact ? 'items-center' : 'items-start',
        )}
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {details && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Технічні деталі</summary>
              <p className="mt-1 break-words font-mono">{details}</p>
            </details>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void onRetry()}
          disabled={isRetrying}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
          {isRetrying ? 'Повтор…' : 'Спробувати ще раз'}
        </Button>
      </div>
    </div>
  )
}

function describeQueryError(error: unknown): string | null {
  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : ''

  if (!message) return null
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Немає з’єднання із сервером або запит заблоковано мережею.'
  }
  if (/supabase is not configured/i.test(message)) {
    return 'Supabase не налаштовано. Перевірте VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY.'
  }
  return message
}
