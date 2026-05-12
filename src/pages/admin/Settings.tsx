import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card, Field, Input } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/dialog'
import { getSetting, upsertSetting, wipeAll } from '@/lib/db'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'

interface DriveConfig {
  name: string
  enabled: boolean
}

export function SettingsPage() {
  const { session } = useAuth()
  const toast = useToast()
  const [drive, setDrive] = useState<DriveConfig>({ name: 'Complaints', enabled: false })
  const [confirmReset, setConfirmReset] = useState(false)

  const { data } = useQuery({
    queryKey: ['app_setting', 'drive.base_folder'],
    queryFn: () => getSetting('drive.base_folder'),
  })

  useEffect(() => {
    if (data?.value) setDrive(data.value as DriveConfig)
  }, [data])

  const save = async () => {
    await upsertSetting('drive.base_folder', drive, session?.user_id ?? null)
    toast.show('Збережено', 'success')
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Налаштування</h1>

      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">Google Drive</h2>
          <p className="text-sm text-muted-foreground">
            У локальному режимі файли зберігаються в IndexedDB браузера. Назва базової папки
            використовується при підключенні реального Google Drive.
          </p>
        </div>
        <Field label="Назва базової папки">
          <Input
            value={drive.name}
            onChange={(e) => setDrive((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>
        <Button onClick={save}>Зберегти</Button>
      </Card>

      <Card className="space-y-3 border-destructive/30 bg-red-50/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h2 className="font-semibold text-destructive">Скинути локальні дані</h2>
            <p className="text-sm text-muted-foreground">
              Видаляє всі скарги, файли, користувачів та налаштування. Сід буде відтворено при
              наступному вході.
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={() => setConfirmReset(true)}>
          <RefreshCw className="h-4 w-4" /> Скинути
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          await wipeAll()
          window.location.reload()
        }}
        title="Скинути всі дані?"
        description="Цю дію не можна скасувати. Локальна база буде очищена."
        confirmLabel="Скинути"
        destructive
      />
    </div>
  )
}
