import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, LinkIcon, RefreshCw } from 'lucide-react'
import { Button, Card } from '@/components/ui/primitives'
import { getSetting } from '@/lib/db'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

interface DriveConnection {
  connected: boolean
  email: string
  folder_name: string
  folder_id: string
  connected_at: string
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

export function SettingsPage() {
  const toast = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['app_setting', 'drive.connection'],
    queryFn: async () => (await getSetting('drive.connection')) ?? null,
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
        return_to: `${window.location.origin}/settings/general`,
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Налаштування</h1>

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
    </div>
  )
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
