import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyAiSuggestion,
  getAiAutomationMode,
  getAiIntents,
  getAiSuggestions,
  saveAiIntents,
  setAiAutomationMode,
  undoLastAiAction,
} from '../../api/ai';
import type { AutomationMode, Intent, RuleAudit, Suggestion } from '../../types';
import ErrorBoundary from '../../components/ErrorBoundary';
import Card from '../../components/Card';
import { useToast } from '../../context/ToastContext';
import SuggestionsPanel from '../../features/ai_policy/SuggestionsPanel';
import AutomationModeSelector from '../../features/ai_policy/AutomationModeSelector';
import IntentEditor from '../../features/ai_policy/IntentEditor';
import AutoActionHistory from '../../features/ai_policy/AutoActionHistory';
import { normalizeAutomationMode } from '../../features/ai_policy/constants';

function toAuditFromSuggestion(suggestion: Suggestion): RuleAudit | null {
  if (!suggestion.decision.auto_applied) return null;

  return {
    id: `suggestion-${suggestion.id}`,
    timestamp: suggestion.decision.timestamp,
    action: suggestion.decision.action,
    reason: suggestion.decision.reason,
    auto_applied: true,
    rule_id: suggestion.rule_id ?? null,
  };
}

function dedupeHistory(entries: RuleAudit[]): RuleAudit[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function AIFirewallAutomationContent() {
  const { addToast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'apply' | 'reject' | null>(null);

  const [intents, setIntents] = useState<Intent[]>([]);
  const [intentsLoading, setIntentsLoading] = useState(true);
  const [intentsSaving, setIntentsSaving] = useState(false);

  const [mode, setMode] = useState<AutomationMode>('monitor_only');
  const [modeLoading, setModeLoading] = useState(true);
  const [modeSaving, setModeSaving] = useState(false);

  const [history, setHistory] = useState<RuleAudit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [undoing, setUndoing] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setHistoryLoading(true);
    setSuggestionsError(null);
    try {
      const res = await getAiSuggestions();
      const allSuggestions = res.data ?? [];
      const pending = allSuggestions.filter((item) => !item.status || item.status === 'pending');
      setSuggestions(pending);

      const fromSuggestions = allSuggestions.map(toAuditFromSuggestion).filter(Boolean) as RuleAudit[];
      setHistory((prev) => dedupeHistory([...fromSuggestions, ...prev]).sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : 'Failed to load AI suggestions');
    } finally {
      setSuggestionsLoading(false);
      setHistoryLoading(false);
    }
  }, []);

  const loadIntents = useCallback(async () => {
    setIntentsLoading(true);
    try {
      const res = await getAiIntents();
      setIntents(res.data ?? []);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load intents', 'error');
    } finally {
      setIntentsLoading(false);
    }
  }, [addToast]);

  const loadMode = useCallback(async () => {
    setModeLoading(true);
    try {
      const res = await getAiAutomationMode();
      const payload = res.data;
      const rawMode = typeof payload === 'string' ? payload : payload.mode;
      setMode(normalizeAutomationMode(rawMode));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load automation mode', 'error');
    } finally {
      setModeLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSuggestions();
    loadIntents();
    loadMode();
  }, [loadSuggestions, loadIntents, loadMode]);

  const handleApplyOrReject = async (suggestionId: string, apply: boolean) => {
    setBusySuggestionId(suggestionId);
    setBusyAction(apply ? 'apply' : 'reject');
    try {
      const res = await applyAiSuggestion({ suggestion_id: suggestionId, apply });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

      const result = res.data;
      if (result && typeof result === 'object' && 'action' in result && 'timestamp' in result && apply) {
        const audit = result as RuleAudit;
        setHistory((prev) => dedupeHistory([audit, ...prev]).sort((a, b) => b.timestamp - a.timestamp));
      }

      addToast(apply ? 'Suggestion applied' : 'Suggestion rejected', 'success');
      await loadSuggestions();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to process suggestion', 'error');
    } finally {
      setBusySuggestionId(null);
      setBusyAction(null);
    }
  };

  const handleSaveIntents = async (nextIntents: Intent[]) => {
    setIntentsSaving(true);
    try {
      const res = await saveAiIntents(nextIntents);
      setIntents(res.data ?? nextIntents);
      addToast('Intents saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save intents', 'error');
      throw err;
    } finally {
      setIntentsSaving(false);
    }
  };

  const handleModeChange = async (nextMode: AutomationMode) => {
    if (nextMode === mode) return;
    setModeSaving(true);
    try {
      const res = await setAiAutomationMode(nextMode);
      const payload = res.data;
      const rawMode = typeof payload === 'string' ? payload : payload.mode;
      setMode(normalizeAutomationMode(rawMode));
      addToast('Automation mode updated', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update automation mode', 'error');
    } finally {
      setModeSaving(false);
    }
  };

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await undoLastAiAction();
      setHistory((prev) => prev.slice(1));
      addToast('Last auto-applied action has been undone', 'success');
      await loadSuggestions();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to undo action', 'error');
    } finally {
      setUndoing(false);
    }
  };

  const pendingSummary = useMemo(() => {
    const total = suggestions.length;
    if (total === 0) return 'No pending suggestions.';
    return `${total} pending suggestion${total === 1 ? '' : 's'}.`;
  }, [suggestions]);

  return (
    <div className="space-y-4">
      <Card
        title="AI Firewall Automation"
        subtitle="Configure deterministic AI-assisted policy automation for monitor, suggest, and full-control flows"
      >
        <p className="text-sm text-gray-600">{pendingSummary}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SuggestionsPanel
            suggestions={suggestions}
            loading={suggestionsLoading}
            error={suggestionsError}
            busySuggestionId={busySuggestionId}
            busyAction={busyAction}
            onRefresh={loadSuggestions}
            onApply={(id) => handleApplyOrReject(id, true)}
            onReject={(id) => handleApplyOrReject(id, false)}
          />
          <IntentEditor
            intents={intents}
            loading={intentsLoading}
            saving={intentsSaving}
            onSave={handleSaveIntents}
          />
        </div>

        <div className="space-y-4">
          <AutomationModeSelector
            mode={mode}
            loading={modeLoading}
            saving={modeSaving}
            onSelect={handleModeChange}
          />
          <AutoActionHistory
            history={history}
            loading={historyLoading}
            undoing={undoing}
            onUndo={handleUndo}
          />
        </div>
      </div>
    </div>
  );
}

export default function AIFirewallAutomation() {
  return (
    <ErrorBoundary fallbackMessage="The AI Firewall Automation page failed to render. Please refresh and try again.">
      <AIFirewallAutomationContent />
    </ErrorBoundary>
  );
}
