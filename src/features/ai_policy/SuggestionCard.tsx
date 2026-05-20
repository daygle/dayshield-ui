import type { Suggestion } from '../../types';
import Button from '../../components/Button';
import { actionToLabel, confidenceClass } from './constants';

interface SuggestionCardProps {
  suggestion: Suggestion;
  busyAction?: 'apply' | 'reject' | null;
  onApply: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

function ActionIcon({ action }: { action: Suggestion['decision']['action'] }) {
  if (action === 'Allow' || action === 'SuggestAllow') {
    return (
      <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (action === 'Deny' || action === 'SuggestDeny' || action === 'RemoveRule') {
    return (
      <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3h7" />
    </svg>
  );
}

export default function SuggestionCard({ suggestion, busyAction = null, onApply, onReject }: SuggestionCardProps) {
  const confidencePct = Math.round(Math.max(0, Math.min(1, suggestion.decision.confidence)) * 100);
  const event = suggestion.event;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ActionIcon action={suggestion.decision.action} />
            <h4 className="text-sm font-semibold text-gray-900">{actionToLabel(suggestion.decision.action)}</h4>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceClass(suggestion.decision.confidence)}`}>
              {confidencePct}% confidence
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">{suggestion.decision.reason || suggestion.suggestion_text || 'No reason provided.'}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-2">
            <span>Source: {event.src_ip ?? 'n/a'}</span>
            <span>Destination: {event.dst_ip ?? 'n/a'}</span>
            <span>Protocol: {event.protocol ?? 'n/a'}</span>
            <span>Service: {event.service ?? 'n/a'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onApply(suggestion.id)} loading={busyAction === 'apply'}>
          Apply
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onReject(suggestion.id)}
          loading={busyAction === 'reject'}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
