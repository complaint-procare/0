import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, File as FileIcon, Film, Image as ImageIcon, Paperclip, Save, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { insert, list } from '@/lib/db'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { Autocomplete } from '@/components/ui/autocomplete'
import { SourcePicker } from '@/components/ui/source-picker'
import { createComplaint } from '@/lib/complaints'
import { useToast } from '@/components/ui/toast'
import { bytesToReadable, fullPhone, isValidUaPhone } from '@/lib/utils'
import type { Product } from '@/lib/types'

export function NewComplaintPage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const { data } = useQuery({
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

  const [form, setForm] = useState({
    source_type: 'network' as 'network' | 'client',
    retail_network_id: '',
    retail_network_name: '',
    phone_suffix: '',
    brand_id: '',
    product_name: '',
    product_barcode: '',
    batch_number: '',
    complaint_group_id: '',
    problem_description: '',
    severity_id: '',
    status_id: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Завантаження…</div>

  const productOptions = data.products
    .filter((p) => p.is_active && (!form.brand_id || p.brand_id === form.brand_id))
    .map((p) => ({
      key: p.id,
      label: p.name,
      hint: p.sku ?? undefined,
      value: p,
    }))
  const productEmptyHint = form.brand_id
    ? 'Для вибраного бренду товарів не знайдено — назва введеться як є'
    : 'Збігів немає — назва введеться як є'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    const retailNetworkName = normalizeRetailNetworkName(form.retail_network_name)
    if (form.source_type === 'network' && !retailNetworkName) {
      toast.show('Вкажіть торгову мережу', 'error')
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
      !form.complaint_group_id ||
      !form.problem_description.trim() ||
      !form.severity_id ||
      !form.status_id
    ) {
      toast.show('Заповніть усі обов\'язкові поля', 'error')
      return
    }
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
          ? await ensureRetailNetworkId(retailNetworkName, data.networks)
          : null
      const c = await createComplaint({
        actor_id: actor.id,
        manager_id: actor.id,
        source_type: form.source_type,
        retail_network_id: retailNetworkId,
        client_phone: fullPhone(form.phone_suffix),
        brand_id: form.brand_id,
        product_name: form.product_name.trim(),
        product_barcode: form.product_barcode.trim(),
        batch_number: form.batch_number.trim(),
        complaint_group_id: form.complaint_group_id,
        problem_description: form.problem_description.trim(),
        severity_id: form.severity_id,
        status_id: form.status_id,
        files,
      })
      await qc.invalidateQueries({ queryKey: ['complaints-page'] })
      await qc.invalidateQueries({ queryKey: ['lookup-data'] })
      toast.show('Скаргу створено', 'success')
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
          <div className="sm:col-span-2">
            <SourcePicker
              sourceType={form.source_type}
              onSourceTypeChange={(t) => setForm((f) => ({ ...f, source_type: t }))}
              networkId={form.retail_network_id}
              onNetworkIdChange={(id) => setForm((f) => ({ ...f, retail_network_id: id }))}
              networkName={form.retail_network_name}
              onNetworkNameChange={(name) =>
                setForm((f) => ({ ...f, retail_network_name: name }))
              }
              phoneSuffix={form.phone_suffix}
              onPhoneSuffixChange={(s) => setForm((f) => ({ ...f, phone_suffix: s }))}
              networks={data.networks}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Назва продукту" required hint="Підказки беруться з каталогу продуктів">
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
                emptyHint={productEmptyHint}
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
                onChange={(e) => {
                  const brandId = e.target.value
                  setForm((f) => {
                    const catalogProduct = data.products.find(
                      (p) =>
                        p.is_active &&
                        ((f.product_barcode && p.sku === f.product_barcode) ||
                          p.name === f.product_name),
                    )
                    const keepProduct = !catalogProduct || !brandId || catalogProduct.brand_id === brandId
                    return {
                      ...f,
                      brand_id: brandId,
                      product_name: keepProduct ? f.product_name : '',
                      product_barcode: keepProduct ? f.product_barcode : '',
                    }
                  })
                }}
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
            <Field label="Група скарги" required>
              <Select
                value={form.complaint_group_id}
                onChange={(e) => setForm((f) => ({ ...f, complaint_group_id: e.target.value }))}
              >
                <option value="">Оберіть…</option>
                {data.groups
                  .filter((g) => g.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk'))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Критичність" required>
              <Select
                value={form.severity_id}
                onChange={(e) => setForm((f) => ({ ...f, severity_id: e.target.value }))}
              >
                <option value="">Оберіть…</option>
                {data.severities
                  .filter((s) => s.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk'))
                  .map((s) => (
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
                <option value="">Оберіть…</option>
                {data.statuses
                  .filter((s) => s.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk'))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Суть претензії" required>
            <Textarea
              rows={4}
              value={form.problem_description}
              onChange={(e) => setForm((f) => ({ ...f, problem_description: e.target.value }))}
            />
          </Field>
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

function normalizeRetailNetworkName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
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
