import Modal from '../../components/Modal'
import type { BackupEntry } from '../../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface RestoreBackupDialogProps {
  open: boolean
  loading: boolean
  entry: BackupEntry | null
  onClose: () => void
  onConfirm: () => void
}

export default function RestoreBackupDialog({
  open,
  loading,
  entry,
  onClose,
  onConfirm,
}: RestoreBackupDialogProps) {
  if (!entry) return null

  return (
    <Modal
      open={open}
      title="Restore Backup"
      onClose={onClose}
      onConfirm={onConfirm}
      confirmLabel="Restore"
      confirmVariant="danger"
      loading={loading}
      size="md"
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <svg
            className="h-5 w-5 text-red-500 shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-red-700">
            <p className="font-semibold">This action will overwrite your current configuration.</p>
            <p className="mt-1">
              All existing settings will be replaced with the contents of this backup. The system
              may briefly restart affected services.
            </p>
          </div>
        </div>

        {/* Backup details */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="col-span-2">
            <dt className="text-gray-500">File</dt>
            <dd className="font-mono text-xs font-medium text-gray-800 break-all">
              {entry.filename}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="font-medium text-gray-800">
              {new Date(entry.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Size</dt>
            <dd className="font-medium text-gray-800">
              {entry.size !== undefined && entry.size !== null ? formatBytes(entry.size) : '—'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-500">SHA256</dt>
            <dd className="font-mono text-xs text-gray-700 break-all">
              {entry.sha256 ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Encrypted</dt>
            <dd className="font-medium text-gray-800">{entry.encrypted ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}
