import type { TrafficCandidate } from '../../types';
import Card from '../../components/Card';
import { actionToLabel, confidenceClass } from './constants';

interface TrafficCandidatesPanelProps {
  candidates: TrafficCandidate[];
  loading: boolean;
  error: string | null;
}

export default function TrafficCandidatesPanel({
  candidates,
  loading,
  error,
}: TrafficCandidatesPanelProps) {
  return (
    <Card
      title="Observed Traffic Candidates"
      subtitle="Recent inbound and outbound traffic patterns the automation engine can translate into scoped allow or deny rules"
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading observed traffic...</p>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No observed traffic candidates yet.
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => {
            const confidencePct = Math.round(
              Math.max(0, Math.min(1, candidate.confidence)) * 100
            );
            return (
              <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {candidate.direction} {candidate.protocol || 'any'} on {candidate.iface || 'n/a'}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceClass(candidate.confidence)}`}
                  >
                    {actionToLabel(candidate.recommended_action)} - {confidencePct}%
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {candidate.observation_count} observation{candidate.observation_count === 1 ? '' : 's'}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-600">{candidate.reason}</p>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500 sm:grid-cols-2 lg:grid-cols-3">
                  <span>Source: {candidate.src_ip || 'n/a'}</span>
                  <span>Destination: {candidate.dst_ip || 'n/a'}</span>
                  <span>Protocol: {candidate.protocol || 'n/a'}</span>
                  <span>Source port: {candidate.src_port ?? 'n/a'}</span>
                  <span>Destination port: {candidate.dst_port ?? 'n/a'}</span>
                  <span>Observed action: {candidate.observed_action || 'n/a'}</span>
                  <span>First seen: {candidate.first_seen}</span>
                  <span>Last seen: {candidate.last_seen}</span>
                  <span>
                    Matched intent: {candidate.matched_intent_name ?? 'No explicit intent'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
