import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import type { AIAutomationSettings } from '../../types';

export type { AIAutomationSettings };

interface AIAutomationSettingsProps {
  settings: AIAutomationSettings;
  loading: boolean;
  saving: boolean;
  onSave: (settings: AIAutomationSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: AIAutomationSettings = {
  autoApplyConfidenceThreshold: 75,
  requireIntentMatch: true,
  requireProtocol: true,
  requireDestinationPort: true,
  requireIpFamily: true,
  maxAutoApplyPerHour: 10,
  allowEditRule: false,
  allowRemoveRule: false,
  protectManagementInterface: true,
};

function clampThreshold(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function AIAutomationSettings({
  settings,
  loading,
  saving,
  onSave,
}: AIAutomationSettingsProps) {
  const [draft, setDraft] = useState<AIAutomationSettings>(settings);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
    setError(null);
  }, [settings]);

  const handleSave = async () => {
    if (draft.maxAutoApplyPerHour < 0) {
      setError('Max auto-applies per hour must be zero or greater.');
      return;
    }
    setError(null);
    await onSave(draft);
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
  };

  return (
    <Card title="Automation Settings" subtitle="Adjust AI firewall automation safety and rule requirements">
      {loading ? (
        <p className="text-sm text-gray-500">Loading settings...</p>
      ) : (
        <div className="space-y-4">
          <FormField
            label="Auto-apply confidence threshold"
            type="number"
            min={0}
            max={100}
            value={String(draft.autoApplyConfidenceThreshold)}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                autoApplyConfidenceThreshold: clampThreshold(Number(e.target.value) || 0),
              }))
            }
            hint="How confident the AI must be before it can auto-apply suggestions."
          />

          <FormField
            label="Max auto-applies per hour"
            type="number"
            min={0}
            value={String(draft.maxAutoApplyPerHour)}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                maxAutoApplyPerHour: Math.max(0, Number(e.target.value) || 0),
              }))
            }
            hint="Limit how many automated firewall changes may occur every hour."
          />

          <div className="space-y-2 rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Rule safety requirements</p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.requireIntentMatch}
                onChange={(e) => setDraft((current) => ({ ...current, requireIntentMatch: e.target.checked }))}
              />
              <span>Require an active intent before auto-applying a suggestion</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.requireProtocol}
                onChange={(e) => setDraft((current) => ({ ...current, requireProtocol: e.target.checked }))}
              />
              <span>Require protocol to be defined for auto-generated rules</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.requireDestinationPort}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, requireDestinationPort: e.target.checked }))
                }
              />
              <span>Require destination port for auto-generated rules</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.requireIpFamily}
                onChange={(e) => setDraft((current) => ({ ...current, requireIpFamily: e.target.checked }))}
              />
              <span>Require IP family (IPv4/IPv6) for auto-generated rules</span>
            </label>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Automated action controls</p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.allowEditRule}
                onChange={(e) => setDraft((current) => ({ ...current, allowEditRule: e.target.checked }))}
              />
              <span>Allow AI to auto-edit existing firewall rules</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.allowRemoveRule}
                onChange={(e) => setDraft((current) => ({ ...current, allowRemoveRule: e.target.checked }))}
              />
              <span>Allow AI to auto-remove rules</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={draft.protectManagementInterface}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, protectManagementInterface: e.target.checked }))
                }
              />
              <span>Protect management interfaces from auto-applied changes</span>
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSave} loading={saving}>
              Save settings
            </Button>
            <Button size="sm" variant="secondary" onClick={handleReset}>
              Reset defaults
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
