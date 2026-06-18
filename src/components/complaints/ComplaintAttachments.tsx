import { useState } from 'react'
import {
  Download,
  ExternalLink,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { addAttachment } from '@/lib/complaints'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/toast'
import { bytesToReadable } from '@/lib/utils'
import type { ComplaintAttachment } from '@/lib/types'

export function ComplaintAttachments({
  complaintId,
  attachments,
  onChanged,
  onRequestDelete,
  disabled,
}: {
  complaintId: string
  attachments: ComplaintAttachment[]
  onChanged: () => void
  onRequestDelete: (attachment: ComplaintAttachment) => void
  disabled: boolean
}) {
  const { session } = useAuth()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        await addAttachment(complaintId, file, session.user_id)
      }
      onChanged()
      toast.show('Файли завантажено', 'success')
    } catch (error) {
      toast.show((error as Error).message, 'error')
    } finally {
      setUploading(false)
      event.target.value = ''
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
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              onDelete={() => onRequestDelete(attachment)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function AttachmentTile({
  attachment,
  onDelete,
  disabled,
}: {
  attachment: ComplaintAttachment
  onDelete: () => void
  disabled: boolean
}) {
  const [thumbFailed, setThumbFailed] = useState(false)
  const isImage = attachment.mime_type.startsWith('image/')
  const isVideo = attachment.mime_type.startsWith('video/')
  const thumbUrl = attachment.drive_file_id
    ? `https://drive.google.com/thumbnail?id=${attachment.drive_file_id}&sz=w800`
    : null
  const viewUrl =
    attachment.drive_url ||
    (attachment.drive_file_id
      ? `https://drive.google.com/file/d/${attachment.drive_file_id}/view`
      : null)
  const canPreview = !!thumbUrl && !thumbFailed && (isImage || isVideo)

  return (
    <div className="card overflow-hidden p-0">
      <a
        href={viewUrl ?? '#'}
        target="_blank"
        rel="noreferrer"
        className="block aspect-square bg-muted"
        title={attachment.file_name}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {canPreview ? (
            <img
              src={thumbUrl}
              alt={attachment.file_name}
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
        <p className="flex items-center gap-1 truncate font-medium" title={attachment.file_name}>
          {isImage ? (
            <ImageIcon className="h-3 w-3 shrink-0" />
          ) : isVideo ? (
            <Film className="h-3 w-3 shrink-0" />
          ) : (
            <FileIcon className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{attachment.file_name}</span>
        </p>
        <p className="text-muted-foreground">{bytesToReadable(attachment.file_size)}</p>
        <div className="flex items-center justify-between pt-1">
          {viewUrl ? (
            <a href={viewUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
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
