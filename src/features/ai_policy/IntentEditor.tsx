import { useEffect, useMemo, useState } from 'react';
import type { DecisionAction, Intent } from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';

interface IntentEditorProps {
  intents: Intent[];
  loading: boolean;
  saving: boolean;
  onSave: (intents: Intent[]) => Promise<void>;
}

const ACTION_OPTIONS: DecisionAction[] = ['Allow', 'Deny', 'EditRule', 'RemoveRule'];

function formatJson(intents: Intent[]): string {
  return JSON.stringify(intents, null, 2);
}

export default function IntentEditor({ intents, loading, saving, onSave }: IntentEditorProps) {
  const [jsonText, setJsonText] = useState<string>(formatJson(intents));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditionKey, setConditionKey] = useState('service');
  const [conditionValue, setConditionValue] = useState('ssh');
  const [desiredAction, setDesiredAction] = useState<DecisionAction>('Deny');

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

  const handleSave = async () => {
    if (!parsedIntents.value) {
      setJsonError(parsedIntents.error);
      return;
    }
    setJsonError(null);
    await onSave(parsedIntents.value);
  };

  const handleAddFromForm = () => {
    if (!name.trim() || !conditionKey.trim() || !conditionValue.trim()) {
      setJsonError('Name, condition key, and condition value are required to add an intent.');
      return;
    }

    const nextIntent: Intent = {
      name: name.trim(),
      description: description.trim() || undefined,
      enabled: true,
      desired_action: desiredAction,
      condition: { [conditionKey.trim()]: conditionValue.trim() },
    };

    const current = parsedIntents.value ?? intents;
    const next = [...current, nextIntent];
    setJsonText(formatJson(next));
    setJsonError(null);
  };

  return (
    <Card title="Intent Editor" subtitle="Define desired policy outcomes with JSON or quick form helpers">
      {loading ? (
        <p className="text-sm text-gray-500">Loading intents...</p>
      ) : (
        <div className="space-y-4">
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
                  {option}
                </option>
              ))}
            </FormField>
            <FormField
              label="Condition key"
              value={conditionKey}
              onChange={(e) => setConditionKey(e.target.value)}
              hint="Examples: service, src_ip, dst_port"
            />
            <FormField
              label="Condition value"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
            />
          </div>

          <FormField
            as="textarea"
            label="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div>
            <Button size="sm" variant="secondary" onClick={handleAddFromForm}>
              Add intent to JSON
            </Button>
          </div>

          <FormField
            as="textarea"
            label="Intents JSON"
            rows={12}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            error={jsonError ?? undefined}
          />

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
