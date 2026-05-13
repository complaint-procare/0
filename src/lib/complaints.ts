import { v4 as uuid } from 'uuid'
import {
  getById,
  insert,
  list,
  update,
} from './db'
import { uploadAttachment } from './supabase'
import type {
  ChangeLogEventType,
  Complaint,
  ComplaintAttachment,
  ComplaintChangeLog,
} from './types'

export interface CreateComplaintInput {
  manager_id: string
  source_type: 'network' | 'client'
  retail_network_id: string | null
  client_phone: string
  brand_id: string | null
  product_name: string
  product_barcode: string
  batch_number: string
  problem_description: string
  severity_id: string
  status_id: string
  custom_fields?: Record<string, unknown>
  files?: File[]
  actor_id: string
}

export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const now = new Date().toISOString()
  const complaint = await insert('complaints', {
    id: uuid(),
    created_at: now,
    created_by: input.actor_id,
    manager_id: input.manager_id,
    source_type: input.source_type,
    retail_network_id: input.source_type === 'network' ? input.retail_network_id : null,
    client_phone: input.source_type === 'client' ? input.client_phone : '',
    brand_id: input.brand_id,
    product_name: input.product_name,
    product_barcode: input.product_barcode,
    batch_number: input.batch_number,
    problem_description: input.problem_description,
    severity_id: input.severity_id,
    status_id: input.status_id,
    drive_folder_id: null,
    drive_folder_url: null,
    closed_at: null,
    updated_at: now,
    custom_fields: input.custom_fields ?? {},
  })

  await logEvent({
    complaint_id: complaint.id,
    actor_id: input.actor_id,
    event_type: 'created',
    field_name: null,
    old_value: null,
    new_value: complaint.number,
  })

  if (input.files?.length) {
    for (const f of input.files) {
      await addAttachment(complaint.id, f, input.actor_id)
    }
  }

  return complaint
}

export async function addAttachment(
  complaintId: string,
  file: File,
  actorId: string,
): Promise<ComplaintAttachment> {
  const uploaded = await uploadAttachment(complaintId, file, actorId)
  await logEvent({
    complaint_id: complaintId,
    actor_id: actorId,
    event_type: 'file_added',
    field_name: null,
    old_value: null,
    new_value: { file_name: uploaded.attachment.file_name, id: uploaded.attachment.id },
  })
  return uploaded.attachment
}

export async function deleteAttachment(attachmentId: string, actorId: string) {
  const att = await getById('complaint_attachments', attachmentId)
  if (!att) return
  await update('complaint_attachments', attachmentId, {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: actorId,
  })
  await logEvent({
    complaint_id: att.complaint_id,
    actor_id: actorId,
    event_type: 'file_deleted',
    field_name: null,
    old_value: { file_name: att.file_name, id: att.id },
    new_value: null,
  })
}

export interface UpdateComplaintInput {
  id: string
  actor_id: string
  patch: Partial<Omit<Complaint, 'id' | 'number' | 'created_at' | 'created_by'>>
  reopen?: boolean
}

export async function updateComplaint(input: UpdateComplaintInput): Promise<Complaint | undefined> {
  const current = await getById('complaints', input.id)
  if (!current) return
  const statuses = await list('complaint_statuses')
  const currentStatus = statuses.find((s) => s.id === current.status_id)
  const targetStatusId = input.patch.status_id ?? current.status_id
  const targetStatus = statuses.find((s) => s.id === targetStatusId)

  if (currentStatus?.is_closed && !input.reopen) {
    throw new Error('Закриту скаргу не можна редагувати. Спочатку перевідкрийте її.')
  }

  const now = new Date().toISOString()
  const patch: Partial<Complaint> = { ...input.patch, updated_at: now }

  if (input.reopen && currentStatus?.is_closed) {
    const newStatus = statuses.find((s) => !s.is_closed && s.is_active)
    if (newStatus) patch.status_id = newStatus.id
    patch.closed_at = null
  }

  if (targetStatus?.is_closed && !current.closed_at) {
    patch.closed_at = now
  }
  if (targetStatus && !targetStatus.is_closed && current.closed_at) {
    patch.closed_at = null
  }

  const next = await update('complaints', input.id, patch)
  if (!next) return

  for (const [key, newVal] of Object.entries(patch)) {
    if (key === 'updated_at') continue
    const oldVal = (current as unknown as Record<string, unknown>)[key]
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue
    if (key === 'status_id' && input.reopen) {
      await logEvent({
        complaint_id: input.id,
        actor_id: input.actor_id,
        event_type: 'reopened',
        field_name: 'status_id',
        old_value: oldVal,
        new_value: newVal,
      })
    } else {
      await logEvent({
        complaint_id: input.id,
        actor_id: input.actor_id,
        event_type: key === 'status_id' ? 'status_changed' : 'field_updated',
        field_name: key,
        old_value: oldVal,
        new_value: newVal,
      })
    }
  }
  return next
}

export async function logEvent(input: {
  complaint_id: string
  actor_id: string
  event_type: ChangeLogEventType
  field_name: string | null
  old_value: unknown
  new_value: unknown
}) {
  const entry: ComplaintChangeLog = {
    id: uuid(),
    complaint_id: input.complaint_id,
    actor_id: input.actor_id,
    event_type: input.event_type,
    field_name: input.field_name,
    old_value: input.old_value,
    new_value: input.new_value,
    created_at: new Date().toISOString(),
  }
  await insert('complaint_change_log', entry)
}

export async function getChangeLog(complaintId: string): Promise<ComplaintChangeLog[]> {
  const rows = await list('complaint_change_log')
  return rows
    .filter((r) => r.complaint_id === complaintId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function getAttachments(complaintId: string): Promise<ComplaintAttachment[]> {
  const rows = await list('complaint_attachments')
  return rows
    .filter((a) => a.complaint_id === complaintId && !a.is_deleted)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}
