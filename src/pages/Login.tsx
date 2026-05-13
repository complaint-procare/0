import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const nav = useNavigate()
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    if (session) nav('/complaints', { replace: true })
  }, [session, nav])

  useEffect(() => {
    refs[0].current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (full: string) => {
    setLoading(true)
    setError(null)
    const res = await signIn(full)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      setPin(['', '', '', ''])
      refs[0].current?.focus()
    } else {
      nav('/complaints', { replace: true })
    }
  }

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[i] = digit
    setPin(next)
    if (digit && i < 3) refs[i + 1].current?.focus()
    if (next.every((d) => d.length === 1)) submit(next.join(''))
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!t) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let i = 0; i < t.length; i++) next[i] = t[i]
    setPin(next)
    if (t.length === 4) submit(t)
    else refs[Math.min(t.length, 3)].current?.focus()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* subtle glow behind card */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-lg">
            <AlertCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Oops!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Введіть 4-значний PIN для входу</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <div className="flex justify-center gap-3">
            {pin.map((d, i) => (
              <input
                key={i}
                ref={refs[i]}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="one-time-code"
                className={cn(
                  'h-14 w-12 rounded-xl border bg-surface text-center text-2xl font-bold text-foreground transition-all',
                  'placeholder:text-muted-foreground focus:outline-none',
                  error
                    ? 'border-destructive/70 focus:ring-2 focus:ring-destructive/30'
                    : 'border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/30',
                  d && !error && 'border-primary/40',
                )}
                type="password"
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <p className="mt-4 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm mt-5 w-full"
            disabled={loading}
            onClick={() => {
              setPin(['', '', '', ''])
              setError(null)
              refs[0].current?.focus()
            }}
          >
            Очистити
          </button>
        </div>

      </div>
    </div>
  )
}
