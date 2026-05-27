import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getBackupSchedule,
  updateBackupSchedule,
  normalizeBackupEntry,
} from '../../api/backup';
import apiClient from '../../api/client';
import type { BackupEntry, BackupSchedule, CreateBackupRequest } from '../../types';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import BackupTable from './BackupTable';
import CreateBackupDialog from './CreateBackupDialog';
import RestoreBackupDialog from './RestoreBackupDialog';
import EncryptionPasswordDialog from './EncryptionPasswordDialog';
import ScheduleForm from './ScheduleForm';
import { useToast } from '../../context/ToastContext';

// ── Default schedule ──────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: BackupSchedule = {
  enabled: false,
  frequency: 'daily',
  time: '02:00',
  retainCount: 7,
  encrypt: false,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BackupRestorePage() {
  // Backup list
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Restore flow
  const [restoreEntry, setRestoreEntry] = useState<BackupEntry | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Delete confirmation dialog
  const [deleteEntry, setDeleteEntry] = useState<BackupEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Encryption password dialog (used for restore of encrypted backups)
  const [encOpen, setEncOpen] = useState(false);
  const pendingPasswordResolve = useRef<((pw: string) => void) | null>(null);

  // Schedule
  const [schedule, setSchedule] = useState<BackupSchedule>(DEFAULT_SCHEDULE);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const { addToast } = useToast();

  // Load backups list
  const loadBackups = useCallback(() => {
    setListLoading(true);
    listBackups()
      .then((res) => setBackups(res.data))
      .catch((err: Error) => addToast(`Failed to load backups: ${err.message}`, 'error'))
      .finally(() => setListLoading(false));
  }, [addToast]);

  // Load schedule
  const loadSchedule = useCallback(() => {
    setScheduleLoading(true);
    getBackupSchedule()
      .then((res) => setSchedule(res.data))
      .catch(() => {
        // Schedule endpoint may not exist yet; use defaults silently
      })
      .finally(() => setScheduleLoading(false));
  }, []);

  useEffect(() => {
    loadBackups();
    loadSchedule();
  }, [loadBackups, loadSchedule]);

  // ── Create backup ──────────────────────────────────────────────────────────

  const handleCreate = (req: CreateBackupRequest) => {
    setCreating(true);
    createBackup(req)
      .then((res) => {
        setBackups((prev) => [res.data, ...prev]);
        setCreateOpen(false);
        addToast(`Backup "${res.data.filename}" created successfully.`, 'success');
      })
      .catch((err: Error) => addToast(`Create backup failed: ${err.message}`, 'error'))
      .finally(() => setCreating(false));
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = (entry: BackupEntry) => {
    downloadBackup(entry.filename).catch((err: Error) =>
      addToast(`Download failed: ${err.message}`, 'error')
    );
  };

  // ── Restore flow ───────────────────────────────────────────────────────────

  const handleRestoreClick = (entry: BackupEntry) => {
    setRestoreEntry(entry);
    setRestoreOpen(true);
  };

  /**
   * If the backup is encrypted, opens the password dialog and waits for the
   * user to enter a password before proceeding.
   */
  const requestPassword = (): Promise<string> =>
    new Promise((resolve) => {
      pendingPasswordResolve.current = resolve;
      setEncOpen(true);
    });

  const handleRestoreConfirm = async () => {
    if (!restoreEntry) return;
    setRestoreOpen(false);

    let passphrase: string | undefined;
    if (restoreEntry.encrypted) {
      passphrase = await requestPassword();
    }

    setRestoring(true);
    restoreBackup({ filename: restoreEntry.filename, passphrase })
      .then(() => {
        addToast(`Backup "${restoreEntry.filename}" restored successfully.`, 'success');
        loadBackups();
      })
      .catch((err: Error) => addToast(`Restore failed: ${err.message}`, 'error'))
      .finally(() => {
        setRestoring(false);
        setRestoreEntry(null);
      });
  };

  const handlePasswordConfirm = (pw: string) => {
    setEncOpen(false);
    pendingPasswordResolve.current?.(pw);
    pendingPasswordResolve.current = null;
  };

  const handleRestoreClose = () => {
    setRestoreOpen(false);
    setRestoreEntry(null);
  };

  const handlePasswordClose = () => {
    setEncOpen(false);
    pendingPasswordResolve.current?.('');
    pendingPasswordResolve.current = null;
    setRestoring(false);
    setRestoreEntry(null);
    addToast('Restore cancelled - password not provided.', 'error');
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteClick = (entry: BackupEntry) => {
    setDeleteEntry(entry);
  };

  const handleDeleteConfirm = () => {
    if (!deleteEntry) return;
    setDeleting(true);
    deleteBackup(deleteEntry.filename)
      .then(() => {
        setBackups((prev) => prev.filter((b) => b.filename !== deleteEntry.filename));
        addToast(`Backup "${deleteEntry.filename}" deleted.`, 'success');
        setDeleteEntry(null);
      })
      .catch((err: Error) => addToast(`Delete failed: ${err.message}`, 'error'))
      .finally(() => setDeleting(false));
  };

  // ── Schedule ───────────────────────────────────────────────────────────────

  const handleSaveSchedule = () => {
    setScheduleSaving(true);
    updateBackupSchedule(schedule)
      .then((res) => {
        setSchedule(res.data);
        addToast('Backup schedule saved.', 'success');
      })
      .catch((err: Error) => addToast(`Save schedule failed: ${err.message}`, 'error'))
      .finally(() => setScheduleSaving(false));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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
        size="lg"
      >
        <p className="text-sm text-gray-600">
          Delete backup <span className="font-semibold">{deleteEntry?.filename}</span>? This action
          cannot be undone.
        </p>
      </Modal>

      {/* Restore in-progress banner */}
      {restoring && (
        <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          <svg
            className="animate-spin h-5 w-5 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" d="M12 2a10 10 0 100 20" />
          </svg>
          <span>Restore in progress - please do not close this page…</span>
        </div>
      )}

      {/* Backups & Restore */}
      <Card
        title="Backups & Restore"
        subtitle="Create, upload, and restore backups from one place."
        actions={
          <>
              <button
              type="button"
              className="btn-icon btn-icon-secondary"
              onClick={() => setCreateOpen(true)}
              disabled={restoring}
              title="Create new backup"
              aria-label="Create new backup"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-500">
          Choose between a <span className="font-medium text-gray-700">full</span> backup (all
          configuration) or a <span className="font-medium text-gray-700">selective</span> backup to
          pick specific components. Backups can optionally be encrypted with a password.
        </p>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-800">Available Backups</h4>
          <div className="mt-3">
            <BackupTable
              entries={backups}
              loading={listLoading}
              restoring={restoring}
              onDownload={handleDownload}
              onRestore={handleRestoreClick}
              onDelete={handleDeleteClick}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-800">Restore from File</h4>
          <p className="mt-1 text-sm text-gray-500">
            Upload a previously downloaded backup file to restore your configuration.
          </p>
          <div className="mt-3">
            <UploadRestoreSection
              restoring={restoring}
              onRestore={(entry) => {
                setBackups((prev) =>
                  prev.find((b) => b.filename === entry.filename) ? prev : [entry, ...prev]
                );
                handleRestoreClick(entry);
              }}
            />
          </div>
        </div>
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

    </div>
  );
}

// ── Upload & Restore section ──────────────────────────────────────────────────

interface UploadRestoreSectionProps {
  restoring: boolean;
  onRestore: (entry: BackupEntry) => void;
}

function UploadRestoreSection({ restoring, onRestore }: UploadRestoreSectionProps) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // POST the file to the server; expect it to return a BackupEntry
      const res = await apiClient.post<{ data: Record<string, unknown>; success: boolean }>(
        '/backup/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const entry = normalizeBackupEntry(res.data.data);
      addToast(`"${entry.filename}" uploaded. Review and confirm restore below.`, 'success');
      onRestore(entry);
    } catch (err) {
      addToast(`Upload failed: ${(err as Error).message}`, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <label
        className={`flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-gray-300 px-5 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors ${
          restoring || uploading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
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
  );
}
