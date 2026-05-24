import { useEffect, useMemo, useState } from 'react';
import type { DecisionAction, Intent } from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import { actionToLabel, normalizeDecisionAction } from './constants';

interface IntentEditorProps {
  intents: Intent[];
  loading: boolean;
  saving: boolean;
  onSave: (intents: Intent[]) => Promise<void>;
}

const ACTION_OPTIONS: DecisionAction[] = ['allow', 'deny', 'edit_rule', 'remove_rule'];

function formatJson(intents: Intent[]): string {
  return JSON.stringify(intents, null, 2);
}

export default function IntentEditor({ intents, loading, saving, onSave }: IntentEditorProps) {
  const [jsonText, setJsonText] = useState<string>(formatJson(intents));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditionKey, setConditionKey] = useState('dst_port');
  const [conditionValue, setConditionValue] = useState('443');
  const [desiredAction, setDesiredAction] = useState<DecisionAction>('deny');
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    setJsonText(formatJson(intents));
    setJsonError(null);
  }, [intents]);

  const parsedIntents = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        return { value: null, error: 'Intent payload must be a JSON array.' };
      }
      return { value: parsed as Intent[], error: null };
    } catch {
      return { value: null, error: 'Invalid JSON format.' };
    }
  }, [jsonText]);

  const intentItems = parsedIntents.value ?? intents;

  const handleSave = async () => {
    if (!parsedIntents.value) {
      setJsonError(parsedIntents.error);
      return;
    }
    const normalizedIntents: Intent[] = [];
    for (const intent of parsedIntents.value) {
      const action = normalizeDecisionAction(intent.desired_action);
      if (!action) {
        setJsonError(`Invalid desired_action for intent "${intent.name || 'unnamed intent'}".`);
        return;
      }
      normalizedIntents.push({
        ...intent,
        desired_action: action,
      });
    }
    setJsonError(null);
    await onSave(normalizedIntents);
  };

  const handleAddFromForm = () => {
    if (!name.trim() || !conditionKey.trim() || !conditionValue.trim()) {
      setJsonError('Name, condition key, and condition value are required to add an intent.');
      return;
    }

    const key = conditionKey.trim();
    let value: string | number = conditionValue.trim();
    if (key === 'src_port' || key === 'dst_port' || key === 'port') {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        setJsonError('Port match values must be whole numbers between 1 and 65535.');
        return;
      }
      value = port;
    }

    const nextIntent: Intent = {
      name: name.trim(),
      description: description.trim() || undefined,
      enabled: true,
      desired_action: desiredAction,
      condition: { [key]: value },
    };

    const current = parsedIntents.value ?? intents;
    const next = [...current, nextIntent];
    setJsonText(formatJson(next));
    setJsonError(null);
    setName('');
    setDescription('');
    setConditionKey('dst_port');
    setConditionValue('443');
    setDesiredAction('deny');
    setShowJson(true);
  };

  const handleRemoveIntent = (index: number) => {
    const current = parsedIntents.value ?? intents;
    const next = current.filter((_, idx) => idx !== index);
    setJsonText(formatJson(next));
    setJsonError(null);
  };

  return (
    <Card title="Traffic Policy Intents" subtitle="Define the traffic patterns the automation engine should allow, block, or tighten into scoped rules">
      {loading ? (
        <p className="text-sm text-gray-500">Loading intents...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Intent name" value={name} onChange={(e) => setName(e.target.value)} />
            <FormField
              as="select"
              label="Desired action"
              value={desiredAction}
              onChange={(e) => setDesiredAction(e.target.value as DecisionAction)}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {actionToLabel(option)}
                </option>
              ))}
            </FormField>
            <FormField
              label="Traffic match field"
              value={conditionKey}
              onChange={(e) => setConditionKey(e.target.value)}
              hint="Examples: iface, direction, protocol, src_ip, dst_ip, dst_port, traffic_scope"
            />
            <FormField
              label="Match value"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              hint="Examples: wan, inbound, tcp, 443, lan"
            />
          </div>

          <FormField
            as="textarea"
            label="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleAddFromForm}>
              Add intent to draft
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowJson((current) => !current)}>
              {showJson ? 'Hide advanced JSON' : 'Show advanced JSON'}
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Intent preview</h3>
                <p className="text-sm text-slate-500">Review traffic-policy intents before they guide allow, deny, or rule-tightening decisions.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {intentItems.length} intent{intentItems.length === 1 ? '' : 's'}
              </span>
            </div>

            {intentItems.length === 0 ? (
              <p className="text-sm text-gray-600">No intents defined yet. Use the form above to add your first intent.</p>
            ) : (
              <div className="space-y-3">
                {intentItems.map((intent, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{intent.name}</p>
                        {intent.description ? (
                          <p className="mt-1 text-sm text-slate-500">{intent.description}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveIntent(index)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
                      <div>
                        <dt className="font-semibold text-slate-900">Action</dt>
                        <dd>{actionToLabel(intent.desired_action)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">Enabled</dt>
                        <dd>{intent.enabled === false ? 'No' : 'Yes'}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-semibold text-slate-900">Condition</dt>
                        <dd>{JSON.stringify(intent.condition)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showJson && (
            <FormField
              as="textarea"
              label="Intents JSON"
              rows={12}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              error={jsonError ?? undefined}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} loading={saving}>
              Save intents
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setJsonText(formatJson(intents))}>
              Reset to server state
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
