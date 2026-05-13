import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Paperclip, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
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
      const [brands, products, networks, statuses, severities, users] = await Promise.all([
        list('brands'),
        list('products'),
        list('retail_networks'),
        list('complaint_statuses'),
        list('severity_levels'),
        list('users'),
      ])
      return { brands, products, networks, statuses, severities, users }
    },
  })

  const [form, setForm] = useState({
    source_type: 'network' as 'network' | 'client',
    retail_network_id: '',
    phone_suffix: '',
    brand_id: '',
    product_name: '',
    product_barcode: '',
    batch_number: '',
    problem_description: '',
    severity_id: '',
    status_id: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Завантаження…</div>

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
      !form.batch_number ||
      !form.problem_description ||
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
      const c = await createComplaint({
        actor_id: actor.id,
        manager_id: actor.id,
        source_type: form.source_type,
        retail_network_id: form.retail_network_id,
        client_phone: fullPhone(form.phone_suffix),
        brand_id: form.brand_id,
        product_name: form.product_name.trim(),
        product_barcode: form.product_barcode.trim(),
        batch_number: form.batch_number,
        problem_description: form.problem_description,
        severity_id: form.severity_id,
        status_id: form.status_id,
        files,
      })
      await qc.invalidateQueries({ queryKey: ['complaints-page'] })
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
                options={data.products
                  .filter((p) => p.is_active)
                  .map((p) => ({
                    key: p.id,
                    label: p.name,
                    hint: p.sku ?? undefined,
                    value: p,
                  }))}
                placeholder="Почніть вводити, напр., кавовий скраб"
                emptyHint="Збігів немає — назва введеться як є"
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
                className="font-mono"
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
                <option value="">Оберіть…</option>
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
                <option value="">Оберіть…</option>
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
            <Input
              type="file"
              multiple
              onChange={(e) =>
                setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
              }
            />
            {files.length > 0 && (
              <ul className="space-y-1 text-xs">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground">{bytesToReadable(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-destructive"
                      aria-label="Прибрати"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
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
