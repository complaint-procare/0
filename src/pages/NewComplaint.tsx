import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, File as FileIcon, Film, Image as ImageIcon, Paperclip, Save, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { insert, list } from '@/lib/db'
import { Button, Card } from '@/components/ui/primitives'
import { ComplaintFormFields } from '@/components/complaints/ComplaintFormFields'
import { createComplaint, requestComplaintResend } from '@/lib/complaints'
import { useToast } from '@/components/ui/toast'
import { bytesToReadable } from '@/lib/utils'
import {
  createEmptyComplaintForm,
  normalizeComplaintForm,
  normalizeRetailNetworkName,
  validateComplaintForm,
} from '@/lib/complaint-form'
import { QueryErrorState } from '@/components/ui/query-state'

export function NewComplaintPage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const { data, error, refetch, isLoading, isError, isFetching } = useQuery({
    queryKey: ['lookup-data'],
    queryFn: async () => {
      const [brands, products, networks, statuses, severities, groups, users] = await Promise.all([
        list('brands'),
        list('products'),
        list('retail_networks'),
        list('complaint_statuses'),
        list('severity_levels'),
        list('complaint_groups'),
        list('users'),
      ])
      return { brands, products, networks, statuses, severities, groups, users }
    },
  })

  const [form, setForm] = useState(() => createEmptyComplaintForm(session?.user_id))
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (isError && !data) {
    return (
      <div className="p-4 md:p-6">
        <QueryErrorState
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
          title="Не вдалося підготувати форму скарги"
          description="Не вдалося завантажити довідники для створення скарги."
        />
      </div>
    )
  }

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Завантаження…</div>
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    const validationError = validateComplaintForm(form)
    if (validationError) {
      toast.show(validationError, 'error')
      return
    }
    const retailNetworkName = normalizeRetailNetworkName(form.retail_network_name)
    setSubmitting(true)
    try {
      const actor = data.users.find((u) => u.id === session.user_id)
        ?? data.users.find((u) => u.full_name === session.full_name && u.role === session.role)
      if (!actor) {
        toast.show('Сесію не знайдено в Supabase. Вийдіть і увійдіть знову.', 'error')
        return
      }
      const retailNetworkId =
        form.source_type === 'network'
          ? form.retail_network_id ||
            await ensureRetailNetworkId(retailNetworkName, data.networks)
          : null
      const normalized = normalizeComplaintForm({
        ...form,
        retail_network_id: retailNetworkId ?? '',
        manager_id: actor.id,
      })
      const c = await createComplaint({
        actor_id: actor.id,
        manager_id: normalized.manager_id,
        source_type: normalized.source_type,
        retail_network_id: normalized.retail_network_id,
        client_phone: normalized.client_phone,
        brand_id: normalized.brand_id,
        product_name: normalized.product_name,
        product_barcode: normalized.product_barcode,
        batch_number: normalized.batch_number,
        complaint_group_id: normalized.complaint_group_id,
        problem_description: normalized.problem_description,
        severity_id: normalized.severity_id,
        status_id: normalized.status_id,
        files,
      })
      let integrationWarning: string | null = null
      if (files.length) {
        try {
          await requestComplaintResend(c.id)
        } catch (resendError) {
          console.error('Failed to request complaint resend after initial attachments upload', resendError)
          integrationWarning = 'Скаргу створено, але не вдалося повторно відправити її в інтеграцію після завантаження файлів.'
        }
      }
      await qc.invalidateQueries({ queryKey: ['complaints-page'] })
      await qc.invalidateQueries({ queryKey: ['lookup-data'] })
      toast.show(integrationWarning ?? 'Скаргу створено', integrationWarning ? 'error' : 'success')
      nav(`/complaints/${c.id}`)
    } catch (err) {
      toast.show((err as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <h1 className="text-xl font-semibold">Нова скарга</h1>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <ComplaintFormFields
            form={form}
            setForm={setForm}
            data={data}
            allowNewNetwork
          />
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <div>
              <p className="label">Менеджер</p>
              <p className="text-sm text-muted-foreground">{session?.full_name}</p>
            </div>
            <div>
              <p className="label">Дата створення</p>
              <p className="text-sm text-muted-foreground">визначається при збереженні</p>
            </div>
            <div>
              <p className="label">Номер</p>
              <p className="text-sm text-muted-foreground">генерується автоматично</p>
            </div>
          </Card>

          <Card className="space-y-3">
            <p className="label flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Файли (необов'язково)
            </p>
            <label className="btn btn-outline w-full cursor-pointer">
              <Upload className="h-4 w-4" />
              {files.length ? `Додати ще (${files.length})` : 'Вибрати файли'}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={submitting}
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? [])
                  if (selected.length) {
                    setFiles((prev) => [...prev, ...selected])
                  }
                  e.target.value = ''
                }}
              />
            </label>
            {files.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Вибрано: {files.length}
                </span>
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => setFiles([])}
                  disabled={submitting}
                >
                  Очистити
                </button>
              </div>
            )}
            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {files.map((f, i) => (
                  <LocalPreviewTile
                    key={`${f.name}-${i}`}
                    file={f}
                    onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}
          </Card>

          <Button type="submit" disabled={submitting} className="w-full">
            <Save className="h-4 w-4" /> {submitting ? 'Збереження…' : 'Створити скаргу'}
          </Button>
        </div>
      </form>
    </div>
  )
}

async function ensureRetailNetworkId(
  name: string,
  networks: { id: string; name: string }[],
): Promise<string> {
  const normalized = normalizeRetailNetworkName(name)
  const existing = networks.find(
    (network) => normalizeRetailNetworkName(network.name).toLowerCase() === normalized.toLowerCase(),
  )
  if (existing) return existing.id

  const created = await insert('retail_networks', {
    name: normalized,
    is_active: true,
  })
  return created.id
}

function LocalPreviewTile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  useEffect(() => {
    if (!isImage && !isVideo) return
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, isImage, isVideo])

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex aspect-square items-center justify-center bg-muted">
        {url && isImage && (
          <img src={url} alt={file.name} className="h-full w-full object-cover" />
        )}
        {url && isVideo && (
          <video src={url} className="h-full w-full object-cover" preload="metadata" muted />
        )}
        {!isImage && !isVideo && <FileIcon className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div className="space-y-1 p-2 text-xs">
        <p className="flex items-center gap-1 truncate font-medium" title={file.name}>
          {isImage ? (
            <ImageIcon className="h-3 w-3 shrink-0" />
          ) : isVideo ? (
            <Film className="h-3 w-3 shrink-0" />
          ) : (
            <FileIcon className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{file.name}</span>
        </p>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{bytesToReadable(file.size)}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-destructive hover:underline"
            aria-label="Прибрати"
          >
            <Trash2 className="inline h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
