import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Field, Input } from '@/components/ui/primitives'
import { getSetting, upsertSetting } from '@/lib/db'
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
            Назва базової папки використовується при завантаженні вкладень через Supabase Edge Function.
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
    </div>
  )
}
