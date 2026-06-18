import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Pencil, RefreshCw, X } from 'lucide-react'
import { getById, list } from '@/lib/db'
import { Button, Card } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/dialog'
import { ComplaintEditor } from '@/components/complaints/ComplaintEditor'
import { ComplaintAttachments } from '@/components/complaints/ComplaintAttachments'
import { ComplaintChangeLogCard } from '@/components/complaints/ComplaintChangeLog'
import { formatDate, formatPhone, padComplaintNumber } from '@/lib/utils'
import {
  deleteAttachment,
  getAttachments,
  getChangeLog,
  requestComplaintResend,
  updateComplaint,
} from '@/lib/complaints'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { SeverityBadge, StatusBadge } from '@/components/Badges'
import type { Complaint, ComplaintAttachment } from '@/lib/types'

export function ComplaintDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { session, isAdmin } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ComplaintAttachment | null>(null)
  const [confirmTouch, setConfirmTouch] = useState(false)
  const [touchingComplaint, setTouchingComplaint] = useState(false)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      if (!id) return null
      const [complaint, statuses, severities, groups, brands, products, networks, users, attachments, log] =
        await Promise.all([
          getById('complaints', id),
          list('complaint_statuses'),
          list('severity_levels'),
          list('complaint_groups'),
          list('brands'),
          list('products'),
          list('retail_networks'),
          list('users'),
          getAttachments(id),
          getChangeLog(id),
        ])
      return { complaint, statuses, severities, groups, brands, products, networks, users, attachments, log }
    },
    enabled: !!id,
  })

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Завантаження…</div>
  }
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

  const complaint = data.complaint
  const status = data.statuses.find((item) => item.id === complaint.status_id)
  const isClosed = !!status?.is_closed

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/complaints')}>
            <ArrowLeft className="h-4 w-4" /> До реєстру
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              Скарга #{padComplaintNumber(complaint.number)}
            </h1>
            <p className="text-xs text-muted-foreground">
              Створено {formatDate(complaint.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge id={complaint.status_id} statuses={data.statuses} />
          <SeverityBadge id={complaint.severity_id} levels={data.severities} />
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
                    id: complaint.id,
                    actor_id: session.user_id,
                    patch: {},
                    reopen: true,
                  })
                  await refetch()
                  await queryClient.invalidateQueries({ queryKey: ['complaints-page'] })
                  toast.show('Скаргу перевідкрито', 'success')
                } catch (error) {
                  toast.show((error as Error).message, 'error')
                }
              }}
            >
              <AlertCircle className="h-4 w-4" /> Перевідкрити
            </Button>
          ) : (
            <Button
              size="sm"
              variant={editing ? 'outline' : 'primary'}
              onClick={() => setEditing((current) => !current)}
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
            <ComplaintEditor
              complaint={complaint}
              data={data}
              onSaved={async () => {
                await refetch()
                await queryClient.invalidateQueries({ queryKey: ['complaints-page'] })
                setEditing(false)
                toast.show('Зміни збережено', 'success')
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ComplaintSummary complaint={complaint} data={data} />
          )}

          <ComplaintAttachments
            complaintId={complaint.id}
            attachments={data.attachments}
            onChanged={refetch}
            onRequestDelete={setConfirmDelete}
            disabled={isClosed}
          />
        </div>

        <ComplaintChangeLogCard
          log={data.log}
          users={data.users}
          statuses={data.statuses}
          severities={data.severities}
          groups={data.groups}
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
          } catch (error) {
            toast.show((error as Error).message, 'error')
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
            await requestComplaintResend(complaint.id)
            await refetch()
            await queryClient.invalidateQueries({ queryKey: ['complaints-page'] })
            toast.show('Скаргу оновлено для повторної обробки', 'success')
          } catch (error) {
            toast.show((error as Error).message, 'error')
          } finally {
            setTouchingComplaint(false)
          }
        }}
        title="Оновити скаргу?"
        description={`Буде оновлено рядок інтеграції для скарги #${padComplaintNumber(complaint.number)}. Це потрібно для повторної обробки зовнішнім n8n.`}
        confirmLabel="Оновити"
      />
    </div>
  )
}

function ComplaintSummary({
  complaint,
  data,
}: {
  complaint: Complaint
  data: {
    users: { id: string; full_name: string }[]
    networks: { id: string; name: string }[]
    brands: { id: string; name: string }[]
    groups: { id: string; name: string }[]
  }
}) {
  return (
    <Card padding={false}>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <DetailRow label="Менеджер" value={byId(data.users, complaint.manager_id, 'full_name')} />
        <DetailRow label="Створив" value={byId(data.users, complaint.created_by, 'full_name')} />
        <DetailRow
          label={complaint.source_type === 'client' ? 'Клієнт (телефон)' : 'Торгова мережа'}
          value={
            complaint.source_type === 'client'
              ? formatPhone(complaint.client_phone)
              : byId(data.networks, complaint.retail_network_id)
          }
          mono={complaint.source_type === 'client'}
        />
        <DetailRow label="Бренд" value={byId(data.brands, complaint.brand_id)} />
        <DetailRow label="Назва продукту" value={complaint.product_name || '—'} />
        <DetailRow label="Штрихкод" value={complaint.product_barcode || '—'} mono />
        <DetailRow label="Номер партії" value={complaint.batch_number} mono />
        <DetailRow label="Група скарги" value={byId(data.groups, complaint.complaint_group_id)} />
      </div>
      <div className="grid grid-cols-1 divide-y divide-border border-t border-border">
        <DetailRow label="Суть претензії" value={complaint.problem_description} multiline />
        <DetailRow label="Рішення / Відповідь" value={complaint.resolution_response} multiline />
      </div>
    </Card>
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
      <p className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function byId<T extends { id: string }>(
  rows: T[],
  id: string | null,
  field: keyof T = 'name' as keyof T,
) {
  if (!id) return '—'
  const row = rows.find((item) => item.id === id)
  return (row?.[field] as string | undefined) ?? '—'
}
