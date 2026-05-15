import type { BackupEntry } from '../../types'
import Table, { Column } from '../../components/Table'
import Button from '../../components/Button'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface BackupTableProps {
  entries: BackupEntry[]
  loading: boolean
  restoring: boolean
  onDownload: (entry: BackupEntry) => void
  onRestore: (entry: BackupEntry) => void
  onDelete: (entry: BackupEntry) => void
}

const columns = (
  restoring: boolean,
  onDownload: (e: BackupEntry) => void,
  onRestore: (e: BackupEntry) => void,
  onDelete: (e: BackupEntry) => void,
): Column<BackupEntry & Record<string, unknown>>[] => [
  {
    key: 'filename',
    header: 'File',
    render: (row) => (
      <span className="font-mono text-xs text-gray-700 break-all">
        {(row as BackupEntry).filename}
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className="text-gray-600">{(row as BackupEntry).type || '-'}</span>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className="text-gray-600">{(row as BackupEntry).version || '-'}</span>
    ),
  },
  {
    key: 'size',
    header: 'Size',
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className="text-gray-600">
        {(row as BackupEntry).size !== undefined && (row as BackupEntry).size !== null
          ? formatBytes((row as BackupEntry).size!)
          : '-'}
      </span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className="text-gray-600">
        {new Date((row as BackupEntry).createdAt).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'sha256',
    header: 'SHA256',
    render: (row) => {
      const sha256 = (row as BackupEntry).sha256
      return (
        <span
          className="font-mono text-xs text-gray-500 truncate block max-w-[140px]"
          title={sha256 ?? 'Computing...'}
        >
          {sha256 ? `${sha256.slice(0, 16)}…` : '-'}
        </span>
      )
    },
  },
  {
    key: 'encrypted',
    header: 'Encrypted',
    render: (row) =>
      (row as BackupEntry).encrypted ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
          Encrypted
        </span>
      ) : (
        <span className="text-gray-400 text-xs">-</span>
      ),
  },
  {
    key: 'actions',
    header: '',
    render: (row) => {
      const entry = row as BackupEntry
      return (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownload(entry)}
            disabled={restoring}
            title="Download backup"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRestore(entry)}
            disabled={restoring}
          >
            Restore
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDelete(entry)}
            disabled={restoring}
          >
            Delete
          </Button>
        </div>
      )
    },
  },
]

export default function BackupTable({
  entries,
  loading,
  restoring,
  onDownload,
  onRestore,
  onDelete,
}: BackupTableProps) {
  return (
    <Table<BackupEntry & Record<string, unknown>>
      columns={columns(restoring, onDownload, onRestore, onDelete)}
      data={entries as (BackupEntry & Record<string, unknown>)[]}
      keyField="filename"
      loading={loading}
      emptyMessage="No backups found. Create your first backup above."
    />
  )
}
