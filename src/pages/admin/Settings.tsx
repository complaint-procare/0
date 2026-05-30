import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Hash, LinkIcon, RefreshCw, RotateCcw } from 'lucide-react'
import { Button, Card } from '@/components/ui/primitives'
import { getSetting } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { formatDate, padComplaintNumber } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/dialog'

interface DriveConnection {
  connected: boolean
  email: string
  folder_name: string
  folder_id: string
  connected_at: string
}

interface ComplaintCounterInfo {
  last_sequence_value: number
  sequence_is_called: boolean
  max_complaint_number: number
  next_complaint_number: number
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const APP_BASE_PATH = import.meta.env.BASE_URL.startsWith('/')
  ? import.meta.env.BASE_URL.replace(/\/$/, '')
  : ''

export function SettingsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { session, isAdmin } = useAuth()
  const [confirmResetCounter, setConfirmResetCounter] = useState(false)
  const [resettingCounter, setResettingCounter] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['app_setting', 'drive.connection'],
    queryFn: async () => (await getSetting('drive.connection')) ?? null,
  })
  const {
    data: counter,
    isLoading: isCounterLoading,
    isError: isCounterError,
  } = useQuery({
    queryKey: ['complaint_number_counter'],
    queryFn: getComplaintCounter,
  })

  const conn = (data?.value ?? null) as DriveConnection | null
  const isConnected = !!conn?.connected

  // Surface the OAuth callback result from URL query params.
  const [callbackError, setCallbackError] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const driveParam = params.get('drive')
    const reason = params.get('reason')
    if (driveParam === 'connected') {
      toast.show('Google Drive підключено', 'success')
      qc.invalidateQueries({ queryKey: ['app_setting', 'drive.connection'] })
      cleanUrl()
    } else if (driveParam === 'error') {
      setCallbackError(reason ?? 'unknown')
      toast.show(`Помилка підключення Drive: ${reason ?? 'unknown'}`, 'error')
      cleanUrl()
    }
  }, [qc, toast])

  const startOauth = () => {
    if (!CLIENT_ID || !SUPABASE_URL) {
      toast.show('VITE_GOOGLE_OAUTH_CLIENT_ID або VITE_SUPABASE_URL не задано', 'error')
      return
    }
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`
    const state = btoa(
      JSON.stringify({
        return_to: `${window.location.origin}${APP_BASE_PATH}/settings/general`,
        nonce: crypto.randomUUID(),
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  const resetCounter = async () => {
    if (!supabase) {
      toast.show('Supabase не налаштовано', 'error')
      return
    }
    if (!session || !isAdmin) {
      toast.show('Скинути лічильник може тільки адміністратор', 'error')
      return
    }

    setResettingCounter(true)
    try {
      const { data, error } = await supabase.rpc('reset_complaint_number_counter', {
        actor_user_id: session.user_id,
      })
      if (error) throw error

      const row = Array.isArray(data) ? data[0] : data
      const nextNumber = Number(row?.next_complaint_number ?? 1)
      await qc.invalidateQueries({ queryKey: ['complaint_number_counter'] })
      toast.show(`Лічильник скинуто. Наступна скарга буде №${padComplaintNumber(nextNumber)}`, 'success')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setResettingCounter(false)
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Налаштування</h1>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Hash className="h-4 w-4" /> Лічильник скарг
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Номер використовується для позначення скарг у форматі №0001, №0002 тощо.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setConfirmResetCounter(true)}
            disabled={!isAdmin || resettingCounter || isCounterLoading}
          >
            <RotateCcw className="h-4 w-4" /> Скинути лічильник
          </Button>
        </div>

        {isCounterLoading ? (
          <p className="text-sm text-muted-foreground">Завантаження лічильника…</p>
        ) : isCounterError ? (
          <p className="text-sm text-destructive">
            Не вдалося завантажити стан лічильника. Перевірте, чи застосована остання міграція Supabase.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info
              label="Останній номер у скаргах"
              value={`№${padComplaintNumber(Number(counter?.max_complaint_number ?? 0))}`}
            />
            <Info
              label="Наступний номер"
              value={`№${padComplaintNumber(Number(counter?.next_complaint_number ?? 1))}`}
            />
            <Info label="Стан лічильника" value={formatCounterState(counter)} />
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Скидання виставляє наступний вільний номер після найбільшого існуючого номера. Воно не
          змінює номери існуючих скарг і не створює дублікати. Якщо скарг немає, наступна скарга
          почнеться з №0001. Дія доступна тільки адміністратору.
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <LinkIcon className="h-4 w-4" /> Google Drive
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Вкладення до скарг завантажуються у ваш Google Drive у папку{' '}
              <span className="font-medium">{conn?.folder_name ?? 'Complaints'}</span>.
            </p>
          </div>
          {isConnected && (
            <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Підключено
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Завантаження…</p>
        ) : isConnected && conn ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Акаунт Google" value={conn.email} />
            <Info label="Папка" value={conn.folder_name} />
            <Info label="Підключено" value={formatDate(conn.connected_at)} />
            <Info
              label="Посилання на папку"
              value={
                <a
                  href={`https://drive.google.com/drive/folders/${conn.folder_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Відкрити <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Drive ще не підключений. Натисніть «Підключити», авторизуйтесь у Google, і застосунок
            створить (або знайде) папку <span className="font-medium">Complaints</span> у вашому диску.
          </div>
        )}

        {callbackError && (
          <p className="text-sm text-destructive">Минула спроба підключення: {callbackError}</p>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={startOauth} variant={isConnected ? 'outline' : 'primary'}>
            {isConnected ? (
              <>
                <RefreshCw className="h-4 w-4" /> Перепідключити
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4" /> Підключити Google Drive
              </>
            )}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmResetCounter}
        onClose={() => setConfirmResetCounter(false)}
        onConfirm={resetCounter}
        title="Скинути лічильник скарг?"
        description="Після підтвердження наступна нова скарга отримає найближчий вільний номер. Існуючі скарги не зміняться."
        confirmLabel="Скинути"
        destructive
      />
    </div>
  )
}

async function getComplaintCounter(): Promise<ComplaintCounterInfo> {
  if (!supabase) throw new Error('Supabase is not configured')

  const { data, error } = await supabase.rpc('get_complaint_number_counter')
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  return {
    last_sequence_value: Number(row?.last_sequence_value ?? 0),
    sequence_is_called: Boolean(row?.sequence_is_called ?? false),
    max_complaint_number: Number(row?.max_complaint_number ?? 0),
    next_complaint_number: Number(row?.next_complaint_number ?? 1),
  }
}

function formatCounterState(counter: ComplaintCounterInfo | undefined): string {
  if (!counter) return '—'
  if (!counter.sequence_is_called) {
    return `Скинуто, очікує №${padComplaintNumber(counter.next_complaint_number)}`
  }
  return `Активний, останнє видане значення ${counter.last_sequence_value}`
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  )
}

function cleanUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('drive')
  url.searchParams.delete('reason')
  window.history.replaceState({}, '', url.toString())
}
