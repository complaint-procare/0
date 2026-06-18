import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Card } from '@/components/ui/primitives'
import { ComplaintFormFields } from './ComplaintFormFields'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { updateComplaint } from '@/lib/complaints'
import {
  complaintToForm,
  normalizeComplaintForm,
  validateComplaintForm,
} from '@/lib/complaint-form'
import type {
  Complaint,
  ComplaintGroup,
  ComplaintStatus,
  Product,
  SeverityLevel,
  User,
} from '@/lib/types'

export interface ComplaintEditorData {
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  groups: ComplaintGroup[]
  brands: { id: string; name: string }[]
  products: Product[]
  networks: { id: string; name: string }[]
  users: User[]
}

export function ComplaintEditor({
  complaint,
  data,
  onSaved,
  onCancel,
}: {
  complaint: Complaint
  data: ComplaintEditorData
  onSaved: () => void
  onCancel: () => void
}) {
  const { session } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(() => complaintToForm(complaint))
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session) return
    const validationError = validateComplaintForm(form)
    if (validationError) {
      toast.show(validationError, 'error')
      return
    }
    setSaving(true)
    try {
      await updateComplaint({
        id: complaint.id,
        actor_id: session.user_id,
        patch: normalizeComplaintForm(form),
      })
      onSaved()
    } catch (error) {
      toast.show((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <ComplaintFormFields
          form={form}
          setForm={setForm}
          data={data}
          showManager
          showResolution
          preservedValues={{
            groupId: complaint.complaint_group_id,
            severityId: complaint.severity_id,
            statusId: complaint.status_id,
          }}
        />
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
