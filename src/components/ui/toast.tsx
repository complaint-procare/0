import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ToastKind = 'info' | 'success' | 'error'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 3500)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-sm',
              t.kind === 'success' && 'border-emerald-700/60 bg-emerald-950/90 text-emerald-300',
              t.kind === 'error' && 'border-red-700/60 bg-red-950/90 text-red-300',
              t.kind === 'info' && 'border-border bg-surface/95 text-foreground',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
