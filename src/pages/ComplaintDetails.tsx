import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Download,
  ExternalLink,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { getById, list } from '@/lib/db'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { Autocomplete } from '@/components/ui/autocomplete'
import { SourcePicker } from '@/components/ui/source-picker'
import { ConfirmDialog } from '@/components/ui/dialog'
import {
  bytesToReadable,
  formatDate,
  formatPhone,
  fullPhone,
  isValidUaPhone,
  padComplaintNumber,
} from '@/lib/utils'
import {
  addAttachment,
  deleteAttachment,
  getAttachments,
  getChangeLog,
  requestComplaintResend,
  updateComplaint,
} from '@/lib/complaints'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { SeverityBadge, StatusBadge } from '@/components/Badges'
import type {
  Complaint,
  ComplaintAttachment,
  ComplaintChangeLog,
  ComplaintStatus,
  Product,
  SeverityLevel,
  User,
} from '@/lib/types'

export function ComplaintDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { session, isAdmin } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ComplaintAttachment | null>(null)
  const [confirmTouch, setConfirmTouch] = useState(false)
  const [touchingComplaint, setTouchingComplaint] = useState(false)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      if (!id) return null
      const [complaint, statuses, severities, brands, products, networks, users, attachments, log] =
        await Promise.all([
          getById('complaints', id),
          list('complaint_statuses'),
          list('severity_levels'),
          list('brands'),
          list('products'),
          list('retail_networks'),
          list('users'),
          getAttachments(id),
          getChangeLog(id),
        ])
      return { complaint, statuses, severities, brands, products, networks, users, attachments, log }
    },
    enabled: !!id,
  })

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Завантаження…</div>
  if (!data.complaint) {
    return (
      <div className="p-6">
        <p className="text-sm">Скаргу не знайдено.</p>
        <Button className="mt-3" onClick={() => nav('/complaints')}>
          До реєстру
        </Button>
      </div>
    )
  }

  const c = data.complaint
  const status = data.statuses.find((s) => s.id === c.status_id)
  const isClosed = !!status?.is_closed

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/complaints')}>
            <ArrowLeft className="h-4 w-4" /> До реєстру
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Скарга #{padComplaintNumber(c.number)}</h1>
            <p className="text-xs text-muted-foreground">Створено {formatDate(c.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge id={c.status_id} statuses={data.statuses} />
          <SeverityBadge id={c.severity_id} levels={data.severities} />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmTouch(true)}
              disabled={touchingComplaint}
              title="Повторити UPDATE для зовнішньої обробки"
            >
              <RefreshCw className="h-4 w-4" /> Оновити
            </Button>
          )}
          {isClosed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!session) return
                try {
                  await updateComplaint({
                    id: c.id,
                    actor_id: session.user_id,
                    patch: {},
                    reopen: true,
                  })
                  await refetch()
                  await qc.invalidateQueries({ queryKey: ['complaints-page'] })
                  toast.show('Скаргу перевідкрито', 'success')
                } catch (e) {
                  toast.show((e as Error).message, 'error')
                }
              }}
            >
              <AlertCircle className="h-4 w-4" /> Перевідкрити
            </Button>
          ) : (
            <Button
              size="sm"
              variant={editing ? 'outline' : 'primary'}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? (
                <>
                  <X className="h-4 w-4" /> Закрити редактор
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" /> Редагувати
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editing && !isClosed ? (
            <EditForm
              complaint={c}
              data={data}
              onSaved={async () => {
                await refetch()
                await qc.invalidateQueries({ queryKey: ['complaints-page'] })
                setEditing(false)
                toast.show('Зміни збережено', 'success')
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <Card padding={false}>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <DetailRow label="Менеджер" value={byId(data.users, c.manager_id, 'full_name')} />
                <DetailRow
                  label="Створив"
                  value={byId(data.users, c.created_by, 'full_name')}
                />
                <DetailRow
                  label={c.source_type === 'client' ? 'Клієнт (телефон)' : 'Торгова мережа'}
                  value={
                    c.source_type === 'client'
                      ? formatPhone(c.client_phone)
                      : byId(data.networks, c.retail_network_id)
                  }
                  mono={c.source_type === 'client'}
                />
                <DetailRow label="Бренд" value={byId(data.brands, c.brand_id)} />
                <DetailRow label="Назва продукту" value={c.product_name || '—'} />
                <DetailRow label="Штрихкод" value={c.product_barcode || '—'} mono />
                <DetailRow label="Номер партії" value={c.batch_number} mono />
              </div>
              <div className="grid grid-cols-1 divide-y divide-border border-t border-border">
                <DetailRow label="Суть претензії" value={c.problem_description} multiline />
              </div>
            </Card>
          )}

          <AttachmentsCard
            complaintId={c.id}
            attachments={data.attachments}
            onChanged={refetch}
            onRequestDelete={(att) => setConfirmDelete(att)}
            disabled={isClosed}
          />
        </div>

        <ChangeLogCard
          log={data.log}
          users={data.users}
          statuses={data.statuses}
          severities={data.severities}
          brands={data.brands}
          networks={data.networks}
        />
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete || !session) return
          try {
            await deleteAttachment(confirmDelete.id, session.user_id)
            await refetch()
            toast.show('Файл видалено', 'success')
          } catch (e) {
            toast.show((e as Error).message, 'error')
          }
        }}
        title="Видалити файл?"
        description={`«${confirmDelete?.file_name}» буде видалено з додатку та сховища. Дію не можна скасувати.`}
        confirmLabel="Видалити"
        destructive
      />
      <ConfirmDialog
        open={confirmTouch}
        onClose={() => setConfirmTouch(false)}
        onConfirm={async () => {
          if (!isAdmin) return
          setTouchingComplaint(true)
          try {
            await requestComplaintResend(c.id)
            await refetch()
            await qc.invalidateQueries({ queryKey: ['complaints-page'] })
            toast.show('Скаргу оновлено для повторної обробки', 'success')
          } catch (e) {
            toast.show((e as Error).message, 'error')
          } finally {
            setTouchingComplaint(false)
          }
        }}
        title="Оновити скаргу?"
        description={`Буде оновлено рядок інтеграції для скарги #${padComplaintNumber(c.number)}. Це потрібно для повторної обробки зовнішнім n8n.`}
        confirmLabel="Оновити"
      />
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  multiline,
}: {
  label: string
  value: string
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <div className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${
          multiline ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {value || '—'}
      </p>
    </div>
  )
}

function byId<T extends { id: string }>(
  rows: T[],
  id: string | null,
  field: keyof T = 'name' as keyof T,
): string {
  if (!id) return '—'
  const f = rows.find((r) => r.id === id)
  return ((f?.[field] as unknown) as string) ?? '—'
}

function EditForm({
  complaint,
  data,
  onSaved,
  onCancel,
}: {
  complaint: Complaint
  data: {
    statuses: ComplaintStatus[]
    severities: SeverityLevel[]
    brands: { id: string; name: string }[]
    products: Product[]
    networks: { id: string; name: string }[]
    users: User[]
  }
  onSaved: () => void
  onCancel: () => void
}) {
  const { session } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    source_type: (complaint.source_type ?? 'network') as 'network' | 'client',
    retail_network_id: complaint.retail_network_id ?? '',
    phone_suffix: (complaint.client_phone ?? '').replace(/^\+?380/, ''),
    brand_id: complaint.brand_id ?? '',
    product_name: complaint.product_name ?? '',
    product_barcode: complaint.product_barcode ?? '',
    batch_number: complaint.batch_number,
    problem_description: complaint.problem_description,
    severity_id: complaint.severity_id ?? '',
    status_id: complaint.status_id ?? '',
    manager_id: complaint.manager_id,
  })
  const [saving, setSaving] = useState(false)
  const productOptions = data.products
    .filter((p) => p.is_active && (!form.brand_id || p.brand_id === form.brand_id))
    .map((p) => ({
      key: p.id,
      label: p.name,
      hint: p.sku ?? undefined,
      value: p,
    }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    if (form.source_type === 'network' && !form.retail_network_id) {
      toast.show('Оберіть торгову мережу', 'error')
      return
    }
    if (form.source_type === 'client' && !isValidUaPhone(form.phone_suffix)) {
      toast.show('Телефон має містити 9 цифр після +380', 'error')
      return
    }
    if (
      !form.brand_id ||
      !form.product_name.trim() ||
      !form.batch_number.trim() ||
      !form.problem_description.trim() ||
      !form.severity_id ||
      !form.status_id
    ) {
      toast.show('Заповніть усі обовʼязкові поля', 'error')
      return
    }
    setSaving(true)
    try {
      await updateComplaint({
        id: complaint.id,
        actor_id: session.user_id,
        patch: {
          source_type: form.source_type,
          retail_network_id:
            form.source_type === 'network' ? form.retail_network_id || null : null,
          client_phone: form.source_type === 'client' ? fullPhone(form.phone_suffix) : '',
          brand_id: form.brand_id || null,
          product_name: form.product_name.trim(),
          product_barcode: form.product_barcode.trim(),
          batch_number: form.batch_number.trim(),
          problem_description: form.problem_description.trim(),
          severity_id: form.severity_id,
          status_id: form.status_id,
          manager_id: form.manager_id,
        },
      })
      onSaved()
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <SourcePicker
          sourceType={form.source_type}
          onSourceTypeChange={(t) => setForm((f) => ({ ...f, source_type: t }))}
          networkId={form.retail_network_id}
          onNetworkIdChange={(id) => setForm((f) => ({ ...f, retail_network_id: id }))}
          phoneSuffix={form.phone_suffix}
          onPhoneSuffixChange={(s) => setForm((f) => ({ ...f, phone_suffix: s }))}
          networks={data.networks}
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Менеджер" required>
            <Select
              value={form.manager_id}
              onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))}
            >
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Назва продукту" required>
            <Autocomplete<Product>
              value={form.product_name}
              onChange={(v) => setForm((f) => ({ ...f, product_name: v }))}
              onSelect={(opt) => {
                setForm((f) => ({
                  ...f,
                  product_name: opt.value.name,
                  product_barcode: opt.value.sku ?? f.product_barcode,
                  brand_id: opt.value.brand_id ?? f.brand_id,
                }))
              }}
              options={productOptions}
              placeholder="Почніть вводити, напр., кавовий скраб"
            />
          </Field>
          <Field label="Штрихкод">
            <Input
              value={form.product_barcode}
              onChange={(e) =>
                setForm((f) => ({ ...f, product_barcode: e.target.value.replace(/\s/g, '') }))
              }
              inputMode="numeric"
              placeholder="Напр., 4820123456789"
            />
          </Field>
          <Field label="Бренд" required>
            <Select
              value={form.brand_id}
              onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
            >
              <option value="">Оберіть…</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Номер партії" required>
            <Input
              value={form.batch_number}
              onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value }))}
            />
          </Field>
          <Field label="Критичність" required>
            <Select
              value={form.severity_id}
              onChange={(e) => setForm((f) => ({ ...f, severity_id: e.target.value }))}
            >
              {data.severities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Статус" required>
            <Select
              value={form.status_id}
              onChange={(e) => setForm((f) => ({ ...f, status_id: e.target.value }))}
            >
              {data.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Суть претензії" required>
          <Textarea
            rows={3}
            value={form.problem_description}
            onChange={(e) => setForm((f) => ({ ...f, problem_description: e.target.value }))}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Скасувати
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" /> Зберегти
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AttachmentsCard({
  complaintId,
  attachments,
  onChanged,
  onRequestDelete,
  disabled,
}: {
  complaintId: string
  attachments: ComplaintAttachment[]
  onChanged: () => void
  onRequestDelete: (att: ComplaintAttachment) => void
  disabled: boolean
}) {
  const { session } = useAuth()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return
    const fl = Array.from(e.target.files ?? [])
    if (!fl.length) return
    setUploading(true)
    try {
      for (const f of fl) {
        await addAttachment(complaintId, f, session.user_id)
      }
      onChanged()
      toast.show('Файли завантажено', 'success')
    } catch (err) {
      toast.show((err as Error).message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Paperclip className="h-4 w-4" /> Файли ({attachments.length})
        </h3>
        {!disabled && (
          <label className="btn btn-outline btn-sm cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Завантаження…' : 'Додати файли'}
            <input type="file" multiple onChange={upload} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Файлів немає.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {attachments.map((a) => (
            <AttachmentTile
              key={a.id}
              att={a}
              onDelete={() => onRequestDelete(a)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function AttachmentTile({
  att,
  onDelete,
  disabled,
}: {
  att: ComplaintAttachment
  onDelete: () => void
  disabled: boolean
}) {
  const [thumbFailed, setThumbFailed] = useState(false)
  const isImage = att.mime_type.startsWith('image/')
  const isVideo = att.mime_type.startsWith('video/')
  const thumbUrl = att.drive_file_id
    ? `https://drive.google.com/thumbnail?id=${att.drive_file_id}&sz=w800`
    : null
  const viewUrl = att.drive_url || (att.drive_file_id ? `https://drive.google.com/file/d/${att.drive_file_id}/view` : null)
  const canPreview = !!thumbUrl && !thumbFailed && (isImage || isVideo)

  return (
    <div className="card overflow-hidden p-0">
      <a
        href={viewUrl ?? '#'}
        target="_blank"
        rel="noreferrer"
        className="block aspect-square bg-muted"
        title={att.file_name}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {canPreview ? (
            <img
              src={thumbUrl!}
              alt={att.file_name}
              className="h-full w-full object-cover"
              onError={() => setThumbFailed(true)}
              loading="lazy"
            />
          ) : (
            <FileIcon className="h-10 w-10 text-muted-foreground" />
          )}
          {canPreview && isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Film className="h-8 w-8 text-white drop-shadow" />
            </div>
          )}
        </div>
      </a>
      <div className="space-y-1 p-2 text-xs">
        <p className="flex items-center gap-1 truncate font-medium" title={att.file_name}>
          {isImage ? (
            <ImageIcon className="h-3 w-3 shrink-0" />
          ) : isVideo ? (
            <Film className="h-3 w-3 shrink-0" />
          ) : (
            <FileIcon className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{att.file_name}</span>
        </p>
        <p className="text-muted-foreground">{bytesToReadable(att.file_size)}</p>
        <div className="flex items-center justify-between pt-1">
          {viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="inline h-3 w-3" /> Відкрити
            </a>
          ) : (
            <span className="text-muted-foreground">
              <Download className="inline h-3 w-3" />
            </span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={onDelete}
              className="text-destructive hover:underline"
              aria-label="Видалити файл"
            >
              <Trash2 className="inline h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  source_type: 'Тип джерела',
  retail_network_id: 'Торгова мережа',
  client_phone: 'Телефон клієнта',
  brand_id: 'Бренд',
  product_name: 'Назва продукту',
  product_barcode: 'Штрихкод',
  batch_number: 'Номер партії',
  problem_description: 'Суть претензії',
  severity_id: 'Критичність',
  status_id: 'Статус',
  manager_id: 'Менеджер',
}

const HIDDEN_FIELDS = new Set(['closed_at', 'updated_at'])

function ChangeLogCard({
  log,
  users,
  statuses,
  severities,
  brands,
  networks,
}: {
  log: ComplaintChangeLog[]
  users: User[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  brands: { id: string; name: string }[]
  networks: { id: string; name: string }[]
}) {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.full_name])), [users])
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s.name])), [statuses])
  const severityMap = useMemo(() => new Map(severities.map((s) => [s.id, s.name])), [severities])
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands])
  const networkMap = useMemo(() => new Map(networks.map((n) => [n.id, n.name])), [networks])

  const lookups = { userMap, statusMap, severityMap, brandMap, networkMap }
  const visible = log.filter((e) => !(e.field_name && HIDDEN_FIELDS.has(e.field_name)))

  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold">Історія змін</h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Подій немає.</p>
      ) : (
        <ul className="space-y-3 text-xs">
          {visible.map((e) => (
            <li key={e.id} className="border-l-2 border-border pl-3">
              <p className="font-medium">{describeEvent(e)}</p>
              <p className="text-muted-foreground">
                {(e.actor_id ? userMap.get(e.actor_id) : null) ?? '—'} · {formatDate(e.created_at)}
              </p>
              {(e.old_value !== null || e.new_value !== null) && e.field_name && (
                <p className="mt-1 break-words text-muted-foreground">
                  {e.old_value !== null && e.old_value !== '' && (
                    <span>
                      Було:{' '}
                      <span className="text-foreground">
                        {formatValue(e.field_name, e.old_value, lookups)}
                      </span>
                    </span>
                  )}
                  {e.old_value !== null &&
                    e.old_value !== '' &&
                    e.new_value !== null &&
                    e.new_value !== '' &&
                    ' → '}
                  {e.new_value !== null && e.new_value !== '' && (
                    <span>
                      Стало:{' '}
                      <span className="text-foreground">
                        {formatValue(e.field_name, e.new_value, lookups)}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function describeEvent(e: ComplaintChangeLog): string {
  switch (e.event_type) {
    case 'created':
      return 'Створено скаргу'
    case 'status_changed':
      return 'Змінено статус'
    case 'reopened':
      return 'Перевідкрито'
    case 'file_added':
      return `Додано файл: ${stringifyFileName(e.new_value)}`
    case 'file_deleted':
      return `Видалено файл: ${stringifyFileName(e.old_value)}`
    case 'field_updated':
      return `Змінено поле: ${fieldLabel(e.field_name)}`
    default:
      return e.event_type
  }
}

function fieldLabel(key: string | null): string {
  if (!key) return '—'
  return FIELD_LABELS[key] ?? key
}

interface LookupMaps {
  userMap: Map<string, string>
  statusMap: Map<string, string>
  severityMap: Map<string, string>
  brandMap: Map<string, string>
  networkMap: Map<string, string>
}

function formatValue(fieldKey: string, value: unknown, lookups: LookupMaps): string {
  if (value === null || value === undefined || value === '') return '—'
  if (fieldKey === 'source_type') {
    return value === 'client' ? 'Клієнт' : value === 'network' ? 'Торгова мережа' : String(value)
  }
  if (typeof value === 'string') {
    if (fieldKey === 'status_id') return lookups.statusMap.get(value) ?? value
    if (fieldKey === 'severity_id') return lookups.severityMap.get(value) ?? value
    if (fieldKey === 'manager_id' || fieldKey === 'created_by')
      return lookups.userMap.get(value) ?? value
    if (fieldKey === 'brand_id') return lookups.brandMap.get(value) ?? value
    if (fieldKey === 'retail_network_id') return lookups.networkMap.get(value) ?? value
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function stringifyFileName(v: unknown): string {
  if (v && typeof v === 'object' && 'file_name' in v) return String((v as { file_name: string }).file_name)
  return '—'
}
