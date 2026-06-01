import { useCallback, useEffect, useState } from 'react';
import { listConfigHistory, getConfigRevision, restoreConfigRevision } from '../../api/config';
import type { ConfigRevision, SystemConfig } from '../../types';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import Table, { Column } from '../../components/Table';
import { useToast } from '../../context/ToastContext';
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConfigHistoryPage() {
  const [revisions, setRevisions] = useState<ConfigRevision[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore confirmation flow.
  const [restoreTarget, setRestoreTarget] = useState<ConfigRevision | null>(null);
  const [restoring, setRestoring] = useState(false);

  // View revision flow.
  const [viewTarget, setViewTarget] = useState<ConfigRevision | null>(null);
  const [viewConfig, setViewConfig] = useState<SystemConfig | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const { addToast } = useToast();
  const { formatDateTime } = useDisplayPreferences();

  const loadRevisions = useCallback(() => {
    setLoading(true);
    listConfigHistory()
      .then((res) => setRevisions(res.data))
      .catch((err: Error) => addToast(`Failed to load config history: ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    loadRevisions();
  }, [loadRevisions]);

  // ── View ───────────────────────────────────────────────────────────────────

  const handleView = (rev: ConfigRevision) => {
    setViewTarget(rev);
    setViewConfig(null);
    setViewLoading(true);
    getConfigRevision(rev.id)
      .then((res) => setViewConfig(res.data))
      .catch((err: Error) => {
        addToast(`Failed to load revision: ${err.message}`, 'error');
        setViewTarget(null);
      })
      .finally(() => setViewLoading(false));
  };

  // ── Restore ──────────────────────────────────────────────────────────────────

  const handleRestoreConfirm = () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoring(true);
    restoreConfigRevision(target.id)
      .then(() => {
        addToast('Configuration revision restored successfully.', 'success');
        setRestoreTarget(null);
        loadRevisions();
      })
      .catch((err: Error) => addToast(`Restore failed: ${err.message}`, 'error'))
      .finally(() => setRestoring(false));
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<ConfigRevision & Record<string, unknown>>[] = [
    {
      key: 'saved_at',
      header: 'Saved',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-gray-700">{formatDateTime(new Date(row.saved_at * 1000))}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-gray-600">{row.description || <em className="text-gray-400">No description</em>}</span>
      ),
    },
    {
      key: 'schema_version',
      header: 'Schema',
      className: 'whitespace-nowrap',
      render: (row) => <span className="text-gray-600">v{row.schema_version}</span>,
    },
    {
      key: 'size_bytes',
      header: 'Size',
      className: 'whitespace-nowrap',
      render: (row) => <span className="text-gray-600">{formatBytes(row.size_bytes)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            className="btn-icon btn-icon-secondary"
            onClick={() => handleView(row)}
            disabled={restoring}
            title="View configuration"
            aria-label="View configuration"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-icon btn-icon-secondary"
            onClick={() => setRestoreTarget(row)}
            disabled={restoring}
            title="Restore this revision"
            aria-label="Restore this revision"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12a9 9 0 109-9m0 0v4m0-4h4m-4 0L5 10"
              />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Restore confirmation */}
      <Modal
        open={restoreTarget !== null}
        title="Restore Configuration Revision"
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreConfirm}
        confirmLabel="Restore"
        confirmVariant="danger"
        loading={restoring}
      >
        <p className="text-sm text-gray-600">
          Restore the configuration saved on{' '}
          <span className="font-semibold">
            {restoreTarget ? formatDateTime(new Date(restoreTarget.saved_at * 1000)) : ''}
          </span>
          ? This replaces the live configuration and applies it to running services. The current
          configuration is archived as a new revision first, so this can be undone.
        </p>
      </Modal>

      {/* View revision */}
      <Modal
        open={viewTarget !== null}
        title={
          viewTarget
            ? `Configuration — ${formatDateTime(new Date(viewTarget.saved_at * 1000))}`
            : 'Configuration'
        }
        onClose={() => setViewTarget(null)}
        size="xl"
      >
        {viewLoading ? (
          <p className="text-sm text-gray-400">Loading configuration…</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-gray-50 border border-gray-200 p-4 text-xs text-gray-700">
            {viewConfig ? JSON.stringify(viewConfig, null, 2) : 'No data.'}
          </pre>
        )}
      </Modal>

      {restoring && (
        <div className="flex items-center gap-3 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          <svg
            className="animate-spin h-5 w-5 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" d="M12 2a10 10 0 100 20" />
          </svg>
          <span>Restore in progress - please do not close this page…</span>
        </div>
      )}

      <Card
        title="Configuration History"
        subtitle="Every saved configuration is archived here. View a past revision or restore it as the live configuration."
        actions={
          <button
            type="button"
            className="btn-icon btn-icon-secondary"
            onClick={loadRevisions}
            disabled={loading || restoring}
            title="Refresh"
            aria-label="Refresh"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        }
      >
        <Table<ConfigRevision & Record<string, unknown>>
          columns={columns}
          data={revisions as (ConfigRevision & Record<string, unknown>)[]}
          keyField="id"
          loading={loading}
          emptyMessage="No configuration revisions yet. Revisions are created automatically when you save changes."
        />
      </Card>
    </div>
  );
}
