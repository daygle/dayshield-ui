import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getBackupSchedule,
  updateBackupSchedule,
} from '../../api/backup'
import apiClient from '../../api/client'
import type {
  BackupEntry,
  BackupSchedule,
  CreateBackupRequest,
} from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import BackupTable from './BackupTable'
import CreateBackupDialog from './CreateBackupDialog'
import RestoreBackupDialog from './RestoreBackupDialog'
import EncryptionPasswordDialog from './EncryptionPasswordDialog'
import ScheduleForm from './ScheduleForm'

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error'

interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

let toastSeq = 0

function Toast({ messages }: { messages: ToastMessage[] }) {
  if (messages.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg text-white ${
            m.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
          role="alert"
        >
          {m.kind === 'success' ? (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )}
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Default schedule ──────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: BackupSchedule = {
  enabled: false,
  frequency: 'daily',
  time: '02:00',
  retainCount: 7,
  encrypt: false,
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BackupRestorePage() {
  // Backup list
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [listLoading, setListLoading] = useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Restore flow
  const [restoreEntry, setRestoreEntry] = useState<BackupEntry | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // Delete confirmation dialog
  const [deleteEntry, setDeleteEntry] = useState<BackupEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Encryption password dialog (used for restore of encrypted backups)
  const [encOpen, setEncOpen] = useState(false)
  const pendingPasswordResolve = useRef<((pw: string) => void) | null>(null)

  // Schedule
  const [schedule, setSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((kind: ToastKind, text: string) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // Load backups list
  const loadBackups = useCallback(() => {
    setListLoading(true)
    listBackups()
      .then((res) => setBackups(res.data))
      .catch((err: Error) => addToast('error', `Failed to load backups: ${err.message}`))
      .finally(() => setListLoading(false))
  }, [addToast])

  // Load schedule
  const loadSchedule = useCallback(() => {
    setScheduleLoading(true)
    getBackupSchedule()
      .then((res) => setSchedule(res.data))
      .catch(() => {
        // Schedule endpoint may not exist yet; use defaults silently
      })
      .finally(() => setScheduleLoading(false))
  }, [])

  useEffect(() => {
    loadBackups()
    loadSchedule()
  }, [loadBackups, loadSchedule])

  // ── Create backup ──────────────────────────────────────────────────────────

  const handleCreate = (req: CreateBackupRequest) => {
    setCreating(true)
    createBackup(req)
      .then((res) => {
        setBackups((prev) => [res.data, ...prev])
        setCreateOpen(false)
        addToast('success', `Backup "${res.data.filename}" created successfully.`)
      })
      .catch((err: Error) => addToast('error', `Create backup failed: ${err.message}`))
      .finally(() => setCreating(false))
  }

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = (entry: BackupEntry) => {
    downloadBackup(entry.filename).catch((err: Error) =>
      addToast('error', `Download failed: ${err.message}`),
    )
  }

  // ── Restore flow ───────────────────────────────────────────────────────────

  const handleRestoreClick = (entry: BackupEntry) => {
    setRestoreEntry(entry)
    setRestoreOpen(true)
  }

  /**
   * If the backup is encrypted, opens the password dialog and waits for the
   * user to enter a password before proceeding.
   */
  const requestPassword = (): Promise<string> =>
    new Promise((resolve) => {
      pendingPasswordResolve.current = resolve
      setEncOpen(true)
    })

  const handleRestoreConfirm = async () => {
    if (!restoreEntry) return
    setRestoreOpen(false)

    let password: string | undefined
    if (restoreEntry.encrypted) {
      password = await requestPassword()
    }

    setRestoring(true)
    restoreBackup({ filename: restoreEntry.filename, password })
      .then(() => {
        addToast('success', `Backup "${restoreEntry.filename}" restored successfully.`)
        loadBackups()
      })
      .catch((err: Error) => addToast('error', `Restore failed: ${err.message}`))
      .finally(() => {
        setRestoring(false)
        setRestoreEntry(null)
      })
  }

  const handlePasswordConfirm = (pw: string) => {
    setEncOpen(false)
    pendingPasswordResolve.current?.(pw)
    pendingPasswordResolve.current = null
  }

  const handleRestoreClose = () => {
    setRestoreOpen(false)
    setRestoreEntry(null)
  }

  const handlePasswordClose = () => {
    setEncOpen(false)
    pendingPasswordResolve.current?.('')
    pendingPasswordResolve.current = null
    setRestoring(false)
    setRestoreEntry(null)
    addToast('error', 'Restore cancelled - password not provided.')
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteClick = (entry: BackupEntry) => {
    setDeleteEntry(entry)
  }

  const handleDeleteConfirm = () => {
    if (!deleteEntry) return
    setDeleting(true)
    deleteBackup(deleteEntry.filename)
      .then(() => {
        setBackups((prev) => prev.filter((b) => b.filename !== deleteEntry.filename))
        addToast('success', `Backup "${deleteEntry.filename}" deleted.`)
        setDeleteEntry(null)
      })
      .catch((err: Error) => addToast('error', `Delete failed: ${err.message}`))
      .finally(() => setDeleting(false))
  }

  // ── Schedule ───────────────────────────────────────────────────────────────

  const handleSaveSchedule = () => {
    setScheduleSaving(true)
    updateBackupSchedule(schedule)
      .then((res) => {
        setSchedule(res.data)
        addToast('success', 'Backup schedule saved.')
      })
      .catch((err: Error) => addToast('error', `Save schedule failed: ${err.message}`))
      .finally(() => setScheduleSaving(false))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Restore in-progress banner */}
      {restoring && (
        <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Restore in progress - please do not close this page…</span>
        </div>
      )}

      {/* Create Backup */}
      <Card
        title="Create Backup"
        subtitle="Generate a new system backup that can be downloaded or used for restoration."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={restoring}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Backup
          </Button>
        }
      >
        <p className="text-sm text-gray-500">
          Choose between a <span className="font-medium text-gray-700">full</span> backup (all
          configuration) or a <span className="font-medium text-gray-700">selective</span> backup
          to pick specific components. Backups can optionally be encrypted with a password.
        </p>
      </Card>

      {/* Available Backups */}
      <Card
        title="Available Backups"
        actions={
          <Button size="sm" variant="secondary" onClick={loadBackups} disabled={listLoading || restoring}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        }
      >
        <BackupTable
          entries={backups}
          loading={listLoading}
          restoring={restoring}
          onDownload={handleDownload}
          onRestore={handleRestoreClick}
          onDelete={handleDeleteClick}
        />
      </Card>

      {/* Restore Backup (upload) */}
      <Card
        title="Restore from File"
        subtitle="Upload a previously downloaded backup file to restore your configuration."
      >
        <UploadRestoreSection
          restoring={restoring}
          onRestore={(entry) => {
            setBackups((prev) =>
              prev.find((b) => b.filename === entry.filename) ? prev : [entry, ...prev],
            )
            handleRestoreClick(entry)
          }}
          addToast={addToast}
        />
      </Card>

      {/* Schedule */}
      <Card title="Scheduled Backups">
        {scheduleLoading ? (
          <p className="text-sm text-gray-400">Loading schedule…</p>
        ) : (
          <ScheduleForm
            schedule={schedule}
            saving={scheduleSaving}
            onChange={setSchedule}
            onSave={handleSaveSchedule}
          />
        )}
      </Card>

      {/* Dialogs */}
      <CreateBackupDialog
        open={createOpen}
        loading={creating}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreate}
      />

      <RestoreBackupDialog
        open={restoreOpen}
        loading={restoring}
        entry={restoreEntry}
        onClose={handleRestoreClose}
        onConfirm={handleRestoreConfirm}
      />

      <EncryptionPasswordDialog
        open={encOpen}
        loading={restoring}
        filename={restoreEntry?.filename ?? ''}
        onClose={handlePasswordClose}
        onConfirm={handlePasswordConfirm}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteEntry !== null}
        title="Delete Backup"
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Delete backup <span className="font-semibold">{deleteEntry?.filename}</span>? This action
          cannot be undone.
        </p>
      </Modal>

      {/* Toasts */}
      <Toast messages={toasts} />
    </div>
  )
}

// ── Upload & Restore section ──────────────────────────────────────────────────

interface UploadRestoreSectionProps {
  restoring: boolean
  onRestore: (entry: BackupEntry) => void
  addToast: (kind: ToastKind, text: string) => void
}

function UploadRestoreSection({ restoring, onRestore, addToast }: UploadRestoreSectionProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      // POST the file to the server; expect it to return a BackupEntry
      const res = await apiClient.post<{ data: BackupEntry; success: boolean }>(
        '/backup/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      addToast('success', `"${res.data.data.filename}" uploaded. Review and confirm restore below.`)
      onRestore(res.data.data)
    } catch (err) {
      addToast('error', `Upload failed: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <label
        className={`flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-gray-300 px-5 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors ${
          restoring || uploading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {uploading ? 'Uploading…' : 'Click to select a backup file'}
        <input
          ref={fileRef}
          type="file"
          accept=".tar,.gz,.tar.gz,.zip,.enc"
          className="sr-only"
          onChange={handleFileChange}
          disabled={restoring || uploading}
        />
      </label>
      <p className="text-xs text-gray-400">
        After upload, you will be asked to confirm before the restore is applied.
      </p>
    </div>
  )
}
