import type { RuleAudit } from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { actionToLabel } from './constants';

interface AutoActionHistoryProps {
  history: RuleAudit[];
  loading: boolean;
  undoing: boolean;
  onUndo: () => void;
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

export default function AutoActionHistory({ history, loading, undoing, onUndo }: AutoActionHistoryProps) {
  return (
    <Card
      title="AI Action History"
      subtitle="Recent AI policy actions that can be undone"
      actions={
        <Button size="sm" variant="secondary" onClick={onUndo} loading={undoing} disabled={history.length === 0}>
          Undo last action
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : history.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No AI-applied actions yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-gray-800">{actionToLabel(entry.action)}</span>
                <span className="text-xs text-gray-500">{formatTimestamp(entry.timestamp)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{entry.reason || 'No reason provided.'}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
