import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyAiSuggestion,
  getAiAutomationSettings,
  getAiAutomationMode,
  getAiIntents,
  getAiTrafficCandidates,
  getAiSuggestions,
  saveAiAutomationSettings,
  saveAiIntents,
  setAiAutomationMode,
  undoLastAiAction,
} from '../../api/ai';
import { getFirewallSettings } from '../../api/firewall';
import type {
  AutomationMode,
  AIAutomationSettings as AIAutomationSettingsType,
  Decision,
  Intent,
  LogPosition,
  NetworkInterface,
  RuleAudit,
  Suggestion,
  TrafficCandidate,
} from '../../types';
import ErrorBoundary from '../../components/ErrorBoundary';
import Card from '../../components/Card';
import FormField from '../../components/FormField';
import { useToast } from '../../context/ToastContext';
import SuggestionsPanel from '../../features/ai_firewall/SuggestionsPanel';
import AutomationModeSelector from '../../features/ai_firewall/AutomationModeSelector';
import IntentEditor from '../../features/ai_firewall/IntentEditor';
import AutoActionHistory from '../../features/ai_firewall/AutoActionHistory';
import AIAutomationSettingsPanel from '../../features/ai_firewall/AIAutomationSettings';
import TrafficCandidatesPanel from '../../features/ai_firewall/TrafficCandidatesPanel';
import { normalizeAutomationMode } from '../../features/ai_firewall/constants';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

function timestampMillis(timestamp: string): number {
  const parsed = new Date(timestamp).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareHistoryDesc(a: RuleAudit, b: RuleAudit): number {
  return timestampMillis(b.timestamp) - timestampMillis(a.timestamp);
}

function toAuditFromDecision(id: string, decision: Decision, ruleId?: string | null): RuleAudit {
  return {
    id,
    timestamp: decision.timestamp,
    action: decision.action,
    reason: decision.reason,
    auto_applied: decision.auto_applied,
    rule_id: ruleId ?? null,
  };
}

function toAuditFromSuggestion(suggestion: Suggestion): RuleAudit | null {
  if (!suggestion.applied && !suggestion.decision.auto_applied) return null;
  return toAuditFromDecision(
    `suggestion-${suggestion.id}`,
    suggestion.decision,
    suggestion.target_rule_id ?? suggestion.rule_id ?? null
  );
}

function dedupeHistory(entries: RuleAudit[]): RuleAudit[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

interface AIFirewallAutomationProps {
  interfaces?: NetworkInterface[];
  selectedInterface?: string | null;
  onSelectInterface?: (iface: string | null) => void;
}

function AIFirewallAutomationContent({
  interfaces = [],
  selectedInterface = null,
  onSelectInterface = () => {},
}: AIFirewallAutomationProps) {
  const { addToast } = useToast();
  const [trafficCandidates, setTrafficCandidates] = useState<TrafficCandidate[]>([]);
  const [trafficCandidatesLoading, setTrafficCandidatesLoading] = useState(true);
  const [trafficCandidatesError, setTrafficCandidatesError] = useState<string | null>(null);
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

  const [automationSettings, setAutomationSettings] = useState<AIAutomationSettingsType>({
    autoApplyConfidenceThreshold: 75,
    requireIntentMatch: true,
    requireProtocol: true,
    requireDestinationPort: true,
    requireIpFamily: true,
    maxAutoApplyPerHour: 10,
    allowEditRule: false,
    allowRemoveRule: false,
    protectManagementInterface: true,
  });
  const [automationSettingsLoading, setAutomationSettingsLoading] = useState(true);
  const [automationSettingsSaving, setAutomationSettingsSaving] = useState(false);

  const [firewallLogPosition, setFirewallLogPosition] = useState<LogPosition | null>(null);
  const [firewallLogPositionLoading, setFirewallLogPositionLoading] = useState(true);
  const [firewallLogPositionError, setFirewallLogPositionError] = useState<string | null>(null);

  const [history, setHistory] = useState<RuleAudit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [undoing, setUndoing] = useState(false);

  const loadTrafficCandidates = useCallback(async () => {
    setTrafficCandidatesLoading(true);
    setTrafficCandidatesError(null);
    try {
      const res = await getAiTrafficCandidates();
      setTrafficCandidates(res.data ?? []);
    } catch (err) {
      setTrafficCandidatesError(
        err instanceof Error ? err.message : 'Failed to load observed traffic candidates'
      );
    } finally {
      setTrafficCandidatesLoading(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setHistoryLoading(true);
    setSuggestionsError(null);
    try {
      const res = await getAiSuggestions();
      const allSuggestions = res.data ?? [];
      const pending = allSuggestions.filter(
        (item) =>
          !item.applied &&
          !item.rejected &&
          (!item.status || item.status === 'pending')
      );
      setSuggestions(pending);

      const fromSuggestions = allSuggestions.map(toAuditFromSuggestion).filter(Boolean) as RuleAudit[];
      setHistory((prev) => dedupeHistory([...fromSuggestions, ...prev]).sort(compareHistoryDesc));
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
      const res = await getAiAutomationMode(selectedInterface ?? undefined);
      setMode(normalizeAutomationMode(res.data));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load automation mode', 'error');
    } finally {
      setModeLoading(false);
    }
  }, [addToast, selectedInterface]);

  const loadAutomationSettings = useCallback(async () => {
    setAutomationSettingsLoading(true);
    try {
      const res = await getAiAutomationSettings();
      setAutomationSettings(res.data);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load automation settings', 'error');
    } finally {
      setAutomationSettingsLoading(false);
    }
  }, [addToast]);

  const loadFirewallLogPosition = useCallback(async () => {
    setFirewallLogPositionLoading(true);
    setFirewallLogPositionError(null);

    try {
      const res = await getFirewallSettings();
      setFirewallLogPosition(res.data?.log_position ?? 'before');
    } catch (err) {
      setFirewallLogPositionError(
        err instanceof Error ? err.message : 'Failed to load firewall log position'
      );
    } finally {
      setFirewallLogPositionLoading(false);
    }
  }, []);

  const handleSaveAutomationSettings = async (nextSettings: AIAutomationSettingsType) => {
    setAutomationSettingsSaving(true);
    try {
      const res = await saveAiAutomationSettings(nextSettings);
      setAutomationSettings(res.data ?? nextSettings);
      addToast('Automation settings saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save automation settings', 'error');
      throw err;
    } finally {
      setAutomationSettingsSaving(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!selectedInterface) return suggestions;

    return suggestions.filter((suggestion) => {
      const iface =
        suggestion.event.iface ??
        suggestion.event.interface ??
        (typeof suggestion.event.metadata?.iface === 'string'
          ? suggestion.event.metadata.iface
          : undefined);
      return iface === selectedInterface;
    });
  }, [suggestions, selectedInterface]);

  const filteredTrafficCandidates = useMemo(() => {
    if (!selectedInterface) return trafficCandidates;
    return trafficCandidates.filter((candidate) => candidate.iface === selectedInterface);
  }, [trafficCandidates, selectedInterface]);

  const selectedInterfaceLabel = selectedInterface
    ? formatInterfaceDisplayName(
        interfaces.find((iface) => iface.name === selectedInterface)?.description,
        selectedInterface
      )
    : undefined;

  useEffect(() => {
    loadTrafficCandidates();
    loadSuggestions();
    loadIntents();
    loadMode();
    loadAutomationSettings();
    loadFirewallLogPosition();
  }, [
    loadTrafficCandidates,
    loadSuggestions,
    loadIntents,
    loadMode,
    loadAutomationSettings,
    loadFirewallLogPosition,
  ]);

  const handleApplyOrReject = async (suggestionId: string, apply: boolean) => {
    setBusySuggestionId(suggestionId);
    setBusyAction(apply ? 'apply' : 'reject');
    try {
      const res = await applyAiSuggestion({ suggestion_id: suggestionId, apply });
      const result = res.data;

      if (apply && !result.applied) {
        addToast(result.message || 'Suggestion was not applied', 'error');
        await loadSuggestions();
        return;
      }

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

      if (apply && result.decision) {
        const audit = toAuditFromDecision(`manual-${suggestionId}`, result.decision);
        setHistory((prev) => dedupeHistory([audit, ...prev]).sort(compareHistoryDesc));
      }

      addToast(result.message || (apply ? 'Suggestion applied' : 'Suggestion rejected'), 'success');
      await loadTrafficCandidates();
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
      const res = await setAiAutomationMode(nextMode, selectedInterface ?? undefined);
      setMode(normalizeAutomationMode(res.data));
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
      const res = await undoLastAiAction();
      if (!res.data?.undone) {
        addToast(res.data?.message || 'No AI action is available to undo', 'info');
        return;
      }
      setHistory((prev) => prev.slice(1));
      addToast(res.data.message || 'Last AI action has been undone', 'success');
      await loadSuggestions();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to undo action', 'error');
    } finally {
      setUndoing(false);
    }
  };

  const pendingSummary = useMemo(() => {
    const total = filteredSuggestions.length;
    if (selectedInterface) {
      const label = selectedInterfaceLabel ?? selectedInterface;
      return `${filteredTrafficCandidates.length} observed traffic candidate${filteredTrafficCandidates.length === 1 ? '' : 's'} and ${total} pending suggestion${total === 1 ? '' : 's'} for ${label}.`;
    }
    return `${filteredTrafficCandidates.length} observed traffic candidate${filteredTrafficCandidates.length === 1 ? '' : 's'} and ${total} pending suggestion${total === 1 ? '' : 's'}.`;
  }, [
    filteredSuggestions.length,
    filteredTrafficCandidates.length,
    selectedInterface,
    selectedInterfaceLabel,
  ]);

  return (
    <div className="space-y-4">
      <Card
        title="AI Firewall"
        subtitle="Monitor observed traffic, match it against traffic-policy intents, and turn high-confidence decisions into scoped firewall rules"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{pendingSummary}</p>
          {firewallLogPositionLoading ? (
            <p className="text-sm text-gray-500">Loading firewall log position...</p>
          ) : firewallLogPositionError ? (
            <p className="text-sm text-red-600">Unable to load firewall log position: {firewallLogPositionError}</p>
          ) : (
            <p className="text-sm text-gray-600">
              Firewall log position is currently <strong>{firewallLogPosition}</strong>. AI automation depends on the firewall log ordering for observed traffic candidates, and <strong>Before</strong> usually gives better visibility into allowed and denied traffic.
            </p>
          )}
          {interfaces.length > 0 && (
            <>
              <FormField
                as="select"
                label="Interface"
                value={selectedInterface ?? ''}
                onChange={(e) => onSelectInterface(e.target.value || null)}
                inputClassName="max-w-xs"
              >
                <option value="">All interfaces</option>
                {interfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {formatInterfaceDisplayName(iface.description, iface.name)}
                  </option>
                ))}
              </FormField>
              <p className="text-xs text-gray-500">
                Interface selection filters the displayed traffic candidates and suggestions. When an interface is selected, the mode panel shows and updates the automation mode for that interface.
              </p>
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <TrafficCandidatesPanel
            candidates={filteredTrafficCandidates}
            loading={trafficCandidatesLoading}
            error={trafficCandidatesError}
          />
          <SuggestionsPanel
            suggestions={filteredSuggestions}
            loading={suggestionsLoading}
            error={suggestionsError}
            busySuggestionId={busySuggestionId}
            busyAction={busyAction}
            interfaceLabels={interfaces.reduce(
              (map, iface) => ({ ...map, [iface.name]: formatInterfaceDisplayName(iface.description, iface.name) }),
              {} as Record<string, string>
            )}
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
          <AIAutomationSettingsPanel
            settings={automationSettings}
            loading={automationSettingsLoading}
            saving={automationSettingsSaving}
            onSave={handleSaveAutomationSettings}
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

export default function AIFirewallAutomation(props: AIFirewallAutomationProps) {
  return (
    <ErrorBoundary fallbackMessage="The AI Firewall page failed to render. Please refresh and try again.">
      <AIFirewallAutomationContent {...props} />
    </ErrorBoundary>
  );
}