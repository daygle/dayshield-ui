import { useCallback, useEffect, useState } from 'react';
import {
  listConfigHistory,
  getConfigRevision,
  restoreConfigRevision,
  deleteConfigRevision,
  getConfigHistorySettings,
  updateConfigHistorySettings,
} from '../../api/config';
import type { ConfigRevision, ConfigHistorySettings, SystemConfig } from '../../types';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Table, { Column } from '../../components/Table';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../context/ToastContext';
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Minimal LCS-based line diff ────────────────────────────────────────────────

type DiffLine = { type: 'ctx' | 'add' | 'del'; text: string };

function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;
  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'ctx', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}

const DEFAULT_SETTINGS: ConfigHistorySettings = { enabled: true, max_revisions: 50 };

export default function ConfigHistoryPage() {
  const [revisions, setRevisions] = useState<ConfigRevision[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore confirmation flow.
  const [restoreTarget, setRestoreTarget] = useState<ConfigRevision | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete confirmation flow.
  const [deleteTarget, setDeleteTarget] = useState<ConfigRevision | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View revision flow.
  const [viewTarget, setViewTarget] = useState<ConfigRevision | null>(null);
  const [viewConfig, setViewConfig] = useState<SystemConfig | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Diff flow (selected revision vs latest).
  const [diffTarget, setDiffTarget] = useState<ConfigRevision | null>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Retention settings.
  const [settings, setSettings] = useState<ConfigHistorySettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const { addToast } = useToast();
  const { formatDateTime } = useDisplayPreferences();

  const loadRevisions = useCallback(() => {
    setLoading(true);
    listConfigHistory()
      .then((res) => setRevisions(res.data))
      .catch((err: Error) => addToast(`Failed to load config history: ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const loadSettings = useCallback(() => {
    getConfigHistorySettings()
      .then((res) => setSettings(res.data))
      .catch(() => {
        // Endpoint may not exist yet; fall back to defaults silently.
      });
  }, []);

  useEffect(() => {
    loadRevisions();
    loadSettings();
  }, [loadRevisions, loadSettings]);

  const latest = revisions[0] ?? null;

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

  // ── Diff (against latest) ────────────────────────────────────────────────────

  const handleDiff = (rev: ConfigRevision) => {
    if (!latest || latest.id === rev.id) return;
    setDiffTarget(rev);
    setDiffLines(null);
    setDiffLoading(true);
    Promise.all([getConfigRevision(rev.id), getConfigRevision(latest.id)])
      .then(([older, newer]) => {
        const oldText = JSON.stringify(older.data, null, 2);
        const newText = JSON.stringify(newer.data, null, 2);
        setDiffLines(lineDiff(oldText, newText));
      })
      .catch((err: Error) => {
        addToast(`Failed to build diff: ${err.message}`, 'error');
        setDiffTarget(null);
      })
      .finally(() => setDiffLoading(false));
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

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    deleteConfigRevision(target.id)
      .then(() => {
        setRevisions((prev) => prev.filter((r) => r.id !== target.id));
        addToast('Revision deleted.', 'success');
        setDeleteTarget(null);
      })
      .catch((err: Error) => addToast(`Delete failed: ${err.message}`, 'error'))
      .finally(() => setDeleting(false));
  };

  // ── Settings ─────────────────────────────────────────────────────────────────

  const handleSaveSettings = () => {
    setSettingsSaving(true);
    updateConfigHistorySettings(settings)
      .then((res) => {
        setSettings(res.data);
        addToast('History settings saved.', 'success');
      })
      .catch((err: Error) => addToast(`Save settings failed: ${err.message}`, 'error'))
      .finally(() => setSettingsSaving(false));
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
      render: (row) =>
        row.description ? (
          <span className="text-gray-600">{row.description}</span>
        ) : (
          <span className="text-gray-400 italic">No description</span>
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
      render: (row) => {
        const isLatest = latest?.id === row.id;
        return (
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
              onClick={() => handleDiff(row)}
              disabled={restoring || isLatest}
              title={isLatest ? 'This is the latest revision' : 'Compare to latest'}
              aria-label="Compare to latest"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 7l3-3M8 7l3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 17H8m8 0l-3 3m3-3l-3-3" />
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
            <button
              type="button"
              className="btn-icon btn-icon-danger"
              onClick={() => setDeleteTarget(row)}
              disabled={restoring}
              title="Delete revision"
              aria-label="Delete revision"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      },
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

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Revision"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      >
        <p className="text-sm text-gray-600">
          Delete the revision saved on{' '}
          <span className="font-semibold">
            {deleteTarget ? formatDateTime(new Date(deleteTarget.saved_at * 1000)) : ''}
          </span>
          ? This removes it from the history permanently and cannot be undone.
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

      {/* Diff vs latest */}
      <Modal
        open={diffTarget !== null}
        title={
          diffTarget
            ? `Diff — ${formatDateTime(new Date(diffTarget.saved_at * 1000))} vs latest`
            : 'Diff'
        }
        onClose={() => setDiffTarget(null)}
        size="xl"
      >
        {diffLoading ? (
          <p className="text-sm text-gray-400">Building diff…</p>
        ) : diffLines && diffLines.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-gray-500">
              <span className="text-red-600">− selected revision</span> ·{' '}
              <span className="text-green-600">+ latest</span>
            </p>
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-gray-50 border border-gray-200 p-4 text-xs leading-5">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.type === 'add'
                      ? 'bg-green-50 text-green-700'
                      : line.type === 'del'
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-600'
                  }
                >
                  {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
                  {line.text}
                </div>
              ))}
            </pre>
          </>
        ) : (
          <p className="text-sm text-gray-400">No differences.</p>
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
        subtitle="Every saved configuration is archived here. View, diff, or restore a past revision."
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

      {/* Retention settings */}
      <Card title="History Settings" subtitle="Control whether revisions are kept and how many.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Archive a revision on every save
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            <span>Maximum revisions to keep</span>
            <input
              type="number"
              min={1}
              value={settings.max_revisions}
              onChange={(e) =>
                setSettings({ ...settings, max_revisions: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            loading={settingsSaving}
            onClick={handleSaveSettings}
          >
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
